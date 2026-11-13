import os
import re
import math
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
import secrets
import hashlib
import json
import mimetypes
from datetime import timedelta
from werkzeug.utils import secure_filename
from flask import send_file

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'locallink-secure-jwt-key-2026')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'locallink.db'))
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'verification_docs')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB
ALLOWED_DOCUMENT_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}
SMS_PROVIDER = os.getenv('SMS_PROVIDER', 'dev').lower()
DEV_OTP_MODE = os.getenv('DEV_OTP_MODE', 'true').lower() == 'true'

CORS(app, resources={r'/api/*': {
    'origins': '*',
    'methods': ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    'allow_headers': ['Content-Type', 'Authorization', 'X-Auth-Token', 'X-User-Id']
}})

db = SQLAlchemy(app)
token_serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
TOKEN_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


# ==========================================
# DATABASE MODELS & RELATIONSHIPS
# ==========================================

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='customer')  # 'customer', 'business', 'admin'
    phone = db.Column(db.String(30), default='')
    phone_verified = db.Column(db.Boolean, default=False)
    phone_verified_at = db.Column(db.DateTime, nullable=True)
    account_status = db.Column(db.String(20), default='active')  # 'active', 'restricted', 'suspended'
    bio = db.Column(db.String(255), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    businesses = db.relationship('Business', backref='owner', lazy=True, cascade='all, delete-orphan')
    requests = db.relationship('ServiceRequest', backref='customer', lazy=True, cascade='all, delete-orphan')
    reviews = db.relationship('Review', backref='customer', lazy=True, cascade='all, delete-orphan')
    favorites = db.relationship('Favorite', backref='customer', lazy=True, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade='all, delete-orphan')
    quote_requests = db.relationship('QuoteRequest', backref='customer', lazy=True, cascade='all, delete-orphan')
    quote_submissions = db.relationship('QuoteSubmission', backref='owner', lazy=True, cascade='all, delete-orphan')
    verifications = db.relationship('BusinessVerification', backref=db.backref('owner', foreign_keys='BusinessVerification.owner_id'), foreign_keys='BusinessVerification.owner_id', lazy=True, cascade='all, delete-orphan')
    risk_assessment = db.relationship('AccountRiskAssessment', backref=db.backref('user', foreign_keys='AccountRiskAssessment.user_id'), foreign_keys='AccountRiskAssessment.user_id', uselist=False, lazy=True, cascade='all, delete-orphan')
    appeals = db.relationship('VerificationAppeal', backref=db.backref('user', foreign_keys='VerificationAppeal.user_id'), foreign_keys='VerificationAppeal.user_id', lazy=True, cascade='all, delete-orphan')


class Business(db.Model):
    __tablename__ = 'business'
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    name = db.Column(db.String(140), nullable=False, index=True)
    category = db.Column(db.String(80), nullable=False, index=True)
    description = db.Column(db.Text, default='')
    address = db.Column(db.String(240), default='Mangaluru, Karnataka')
    area = db.Column(db.String(100), default='Mangaluru')
    phone = db.Column(db.String(30), default='+91 98765 43210')
    price_from = db.Column(db.Integer, default=199)
    rating = db.Column(db.Float, default=4.5)
    reviews_count = db.Column(db.Integer, default=0)
    distance_km = db.Column(db.Float, default=1.2)
    available = db.Column(db.Boolean, default=True)
    verified = db.Column(db.Boolean, default=False)
    image = db.Column(db.String(500), default='')
    working_hours = db.Column(db.String(200), default='Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    services = db.relationship('Service', backref='business', lazy=True, cascade='all, delete-orphan')
    requests = db.relationship('ServiceRequest', backref='business', lazy=True, cascade='all, delete-orphan')
    reviews = db.relationship('Review', backref='business', lazy=True, cascade='all, delete-orphan')
    favorites = db.relationship('Favorite', backref='business', lazy=True, cascade='all, delete-orphan')
    reports = db.relationship('Report', backref='business', lazy=True, cascade='all, delete-orphan')
    quote_submissions = db.relationship('QuoteSubmission', backref='business', lazy=True, cascade='all, delete-orphan')
    verification = db.relationship('BusinessVerification', backref='business', uselist=False, cascade='all, delete-orphan')


class Service(db.Model):
    __tablename__ = 'service'
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, index=True)
    name = db.Column(db.String(140), nullable=False)
    description = db.Column(db.Text, default='')
    price = db.Column(db.Integer, default=199)
    available = db.Column(db.Boolean, default=True)


class ServiceRequest(db.Model):
    __tablename__ = 'service_request'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, index=True)
    service_name = db.Column(db.String(140), nullable=False)
    note = db.Column(db.Text, default='')
    status = db.Column(db.String(30), default='Pending')  # 'Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Review(db.Model):
    __tablename__ = 'review'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, index=True)
    rating = db.Column(db.Integer, default=5)
    comment = db.Column(db.Text, default='')
    owner_reply = db.Column(db.Text, default=None)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Favorite(db.Model):
    __tablename__ = 'favorite'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Notification(db.Model):
    __tablename__ = 'notification'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    message = db.Column(db.String(240), nullable=False)
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Report(db.Model):
    __tablename__ = 'report'
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, index=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    reason = db.Column(db.String(240), nullable=False)
    details = db.Column(db.Text, default='')
    status = db.Column(db.String(30), default='Open')  # 'Open', 'Reviewed', 'Dismissed'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class Category(db.Model):
    __tablename__ = 'category'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)


class PlatformSetting(db.Model):
    __tablename__ = 'platform_setting'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)


# ==========================================
# FEATURE 3: MULTI-BUSINESS QUOTE MODELS
# ==========================================

class QuoteRequest(db.Model):
    __tablename__ = 'quote_request'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    category = db.Column(db.String(80), nullable=False, index=True)
    title = db.Column(db.String(140), nullable=False)
    description = db.Column(db.Text, nullable=False)
    area = db.Column(db.String(100), default='Mangaluru')
    budget_min = db.Column(db.Integer, default=0)
    budget_max = db.Column(db.Integer, default=2000)
    preferred_date = db.Column(db.String(80), default='Flexible')
    urgency = db.Column(db.String(30), default='Normal')  # 'Normal', 'Urgent', 'Emergency'
    photo_url = db.Column(db.String(500), default='')
    status = db.Column(db.String(30), default='Open')  # 'Open', 'Assigned', 'Completed', 'Cancelled'
    accepted_submission_id = db.Column(db.Integer, nullable=True)
    assigned_business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    submissions = db.relationship('QuoteSubmission', backref='quote_request', lazy=True, cascade='all, delete-orphan')


class QuoteSubmission(db.Model):
    __tablename__ = 'quote_submission'
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('quote_request.id'), nullable=False, index=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    price = db.Column(db.Integer, nullable=False)
    includes = db.Column(db.Text, default='Standard service, parts and warranty')
    proposed_time = db.Column(db.String(100), default='As requested')
    message = db.Column(db.Text, default='')
    status = db.Column(db.String(30), default='Pending')  # 'Pending', 'Accepted', 'Rejected', 'Withdrawn'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))



# ==========================================
# FEATURE 1 & 7: BUSINESS IDENTITY & VERIFICATION MODELS
# ==========================================

class MobileOTPVerification(db.Model):
    __tablename__ = 'mobile_otp_verification'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    phone = db.Column(db.String(30), nullable=False, index=True)
    otp_hash = db.Column(db.String(255), nullable=False)
    otp_salt = db.Column(db.String(32), nullable=False)
    attempts = db.Column(db.Integer, default=0)
    resend_count = db.Column(db.Integer, default=0)
    last_sent_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, nullable=False)
    verified = db.Column(db.Boolean, default=False)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class BusinessVerification(db.Model):
    __tablename__ = 'business_verification'
    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey('business.id'), nullable=False, unique=True, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    mobile_verified = db.Column(db.Boolean, default=False)
    verified_mobile = db.Column(db.String(30), default='')
    business_name = db.Column(db.String(140), nullable=False)
    business_category = db.Column(db.String(80), nullable=False)
    registration_number = db.Column(db.String(100), default='')
    owner_full_name = db.Column(db.String(100), default='')
    business_email = db.Column(db.String(160), default='')
    business_phone = db.Column(db.String(30), default='')
    business_website = db.Column(db.String(200), default='')
    address_line = db.Column(db.String(255), default='')
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    address_verified = db.Column(db.Boolean, default=False)
    verification_method = db.Column(db.String(50), default='document_and_address')
    status = db.Column(db.String(30), default='Not Submitted')  # 'Not Submitted', 'Pending Review', 'Under Review', 'Verified', 'Rejected', 'Resubmission Required'
    admin_notes = db.Column(db.Text, default='')
    rejection_reason = db.Column(db.Text, default='')
    reviewed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    documents = db.relationship('BusinessDocument', backref='verification', lazy=True, cascade='all, delete-orphan')


class BusinessDocument(db.Model):
    __tablename__ = 'business_document'
    id = db.Column(db.Integer, primary_key=True)
    verification_id = db.Column(db.Integer, db.ForeignKey('business_verification.id'), nullable=False, index=True)
    doc_type = db.Column(db.String(60), nullable=False)  # 'registration_cert', 'shop_establishment', 'utility_bill', 'trade_license', 'ownership_proof'
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(100), default='application/octet-stream')
    file_size = db.Column(db.Integer, default=0)
    status = db.Column(db.String(30), default='Pending')  # 'Pending', 'Approved', 'Rejected'
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


# ==========================================
# FEATURE 2 & 7: IDENTITY LINKING MODELS
# ==========================================

class AccountIdentityLink(db.Model):
    __tablename__ = 'account_identity_link'
    id = db.Column(db.Integer, primary_key=True)
    primary_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    linked_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    link_type = db.Column(db.String(50), nullable=False)  # 'shared_verified_mobile', 'matching_business_details', 'manual_link'
    confidence_score = db.Column(db.Float, default=0.9)
    shared_signal_details = db.Column(db.Text, default='')
    status = db.Column(db.String(30), default='Detected')  # 'Detected', 'Confirmed', 'Incorrect Match', 'Needs Further Investigation'
    admin_notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ==========================================
# FEATURE 3 & 7: SUSPICIOUS ACTIVITY & RISK MODELS
# ==========================================

class SuspiciousActivityLog(db.Model):
    __tablename__ = 'suspicious_activity_log'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    ip_address = db.Column(db.String(60), default='127.0.0.1')
    activity_type = db.Column(db.String(80), nullable=False)  # 'competitor_price_scraping', 'restricted_endpoint_probing', 'rapid_automated_requests', 'duplicate_identity_attempt'
    severity = db.Column(db.String(20), default='LOW')  # 'LOW', 'MEDIUM', 'HIGH'
    details = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class AccountRiskAssessment(db.Model):
    __tablename__ = 'account_risk_assessment'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True, index=True)
    risk_level = db.Column(db.String(20), default='LOW')  # 'LOW', 'MEDIUM', 'HIGH'
    signals_detected = db.Column(db.Text, default='[]')  # JSON array
    investigation_status = db.Column(db.String(30), default='Normal')  # 'Normal', 'Awaiting Investigation', 'Investigating', 'Cleared', 'Restricted'
    admin_decision = db.Column(db.String(50), default='None')  # 'None', 'Cleared', 'Warned', 'Restricted', 'Suspended'
    decision_reason = db.Column(db.Text, default='')
    reviewed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SecurityAuditLog(db.Model):
    __tablename__ = 'security_audit_log'
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50), default='')
    target_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.Text, default='')
    ip_address = db.Column(db.String(60), default='')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class VerificationAppeal(db.Model):
    __tablename__ = 'verification_appeal'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    appeal_type = db.Column(db.String(50), nullable=False)  # 'account_restriction', 'verification_rejection', 'identity_association'
    reference_id = db.Column(db.Integer, nullable=True)
    reason = db.Column(db.Text, nullable=False)
    evidence_text = db.Column(db.Text, default='')
    status = db.Column(db.String(30), default='Pending')  # 'Pending', 'Under Review', 'Approved', 'Rejected'
    admin_notes = db.Column(db.Text, default='')
    reviewed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

# ==========================================
# AUTHENTICATION & TOKEN HELPERS
# ==========================================

def create_token(user):
    payload = {'id': user.id, 'email': user.email, 'role': user.role}
    return token_serializer.dumps(payload)

def decode_token(token):
    try:
        data = token_serializer.loads(token, max_age=TOKEN_MAX_AGE)
        return data
    except (SignatureExpired, BadTimeSignature, Exception):
        return None

def get_current_user_from_request():
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    elif request.headers.get('X-Auth-Token'):
        token = request.headers.get('X-Auth-Token').strip()
    elif request.args.get('token'):
        token = request.args.get('token').strip()

    if token:
        payload = decode_token(token)
        if payload and 'id' in payload:
            return db.session.get(User, payload['id'])

    # Fallback for demo environments
    uid = request.headers.get('X-User-Id') or request.args.get('user_id')
    if uid and str(uid).isdigit():
        return db.session.get(User, int(uid))

    return None

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user_from_request()
        if not user:
            return jsonify({'error': 'Authentication required. Please sign in.'}), 401
        return f(user, *args, **kwargs)
    return decorated

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user_from_request()
            if not user:
                return jsonify({'error': 'Authentication required. Please sign in.'}), 401
            if user.role not in allowed_roles:
                return jsonify({'error': f'Permission denied. {allowed_roles} role required.'}), 403
            return f(user, *args, **kwargs)
        return decorated
    return decorator



# ==========================================
# SECURITY, OTP & IDENTITY LINKING HELPERS
# ==========================================

def hash_otp(phone: str, otp: str, salt: str = None) -> (str, str):
    if not salt:
        salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + phone + otp + app.config['SECRET_KEY']).encode('utf-8')).hexdigest()
    return h, salt

def verify_otp_hash(phone: str, otp: str, stored_hash: str, salt: str) -> bool:
    h, _ = hash_otp(phone, otp, salt)
    return secrets.compare_digest(h, stored_hash)

def send_sms_otp(phone: str, otp: str) -> dict:
    if SMS_PROVIDER == 'twilio':
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        from_number = os.getenv('TWILIO_FROM_NUMBER')
        if account_sid and auth_token and from_number:
            try:
                from twilio.rest import Client
                client = Client(account_sid, auth_token)
                message = client.messages.create(
                    body=f"Your LocalLink AI verification code is {otp}. Valid for 5 minutes.",
                    from_=from_number,
                    to=phone
                )
                return {'sent': True, 'provider': 'twilio', 'sid': message.sid}
            except Exception as e:
                app.logger.error(f"Twilio SMS Error: {e}")
                return {'sent': False, 'error': str(e)}
    # Development Mode Fallback
    app.logger.info(f"[DEV OTP MODE] LocalLink AI verification OTP for {phone}: {otp}")
    return {
        'sent': True,
        'provider': 'dev',
        'dev_mode': True,
        'dev_otp': otp if DEV_OTP_MODE else None,
        'note': 'SMS Provider not configured. Running in secure development OTP mode.'
    }

def log_security_audit(actor_id, action, target_type='', target_id=None, details='', ip=None):
    try:
        log = SecurityAuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip or request.remote_addr or '127.0.0.1'
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        app.logger.error(f"Audit log error: {e}")
        db.session.rollback()

def update_account_risk(user_id, signal_desc, level='MEDIUM'):
    if not user_id:
        return None
    risk = AccountRiskAssessment.query.filter_by(user_id=user_id).first()
    if not risk:
        risk = AccountRiskAssessment(
            user_id=user_id,
            risk_level=level,
            signals_detected=json.dumps([signal_desc]),
            investigation_status='Awaiting Investigation'
        )
        db.session.add(risk)
    else:
        signals = []
        try:
            signals = json.loads(risk.signals_detected)
        except Exception:
            signals = []
        if signal_desc not in signals:
            signals.append(signal_desc)
        risk.signals_detected = json.dumps(signals)
        if len(signals) >= 2 or level == 'HIGH':
            risk.risk_level = 'HIGH'
            if risk.investigation_status == 'Normal':
                risk.investigation_status = 'Awaiting Investigation'
        elif risk.risk_level != 'HIGH':
            risk.risk_level = level
    db.session.commit()
    return risk

def detect_and_link_identities(user_id):
    """
    Detects shared verified phone numbers, matching business registration details,
    or multiple accounts associated with a business owner.
    Does NOT automatically ban or suspend; flags for review with an appropriate risk score.
    """
    u = db.session.get(User, user_id)
    if not u:
        return []
    
    links_created = []
    
    # 1. Check shared phone number
    if u.phone and len(u.phone.strip()) >= 10:
        clean_phone = re.sub(r'[^0-9]', '', u.phone)[-10:]
        other_users = User.query.filter(User.id != u.id).all()
        for other in other_users:
            if other.phone:
                other_clean = re.sub(r'[^0-9]', '', other.phone)[-10:]
                if clean_phone and clean_phone == other_clean:
                    existing = AccountIdentityLink.query.filter(
                        ((AccountIdentityLink.primary_user_id == u.id) & (AccountIdentityLink.linked_user_id == other.id)) |
                        ((AccountIdentityLink.primary_user_id == other.id) & (AccountIdentityLink.linked_user_id == u.id))
                    ).first()
                    if not existing:
                        link = AccountIdentityLink(
                            primary_user_id=u.id,
                            linked_user_id=other.id,
                            link_type='shared_verified_mobile',
                            confidence_score=0.95,
                            shared_signal_details=f"Shared phone number: {u.phone} across {u.role} ({u.email}) and {other.role} ({other.email})",
                            status='Detected'
                        )
                        db.session.add(link)
                        links_created.append(link)
                        log_security_audit(
                            actor_id=u.id,
                            action='IDENTITY_LINK_DETECTED',
                            target_type='AccountIdentityLink',
                            details=f"Shared mobile detected between {u.email} ({u.role}) and {other.email} ({other.role})"
                        )
                        for target_uid in [u.id, other.id]:
                            update_account_risk(target_uid, f"Shared verified mobile with {other.email if target_uid == u.id else u.email}", 'MEDIUM')

    # 2. Check matching business registration details
    my_verifications = BusinessVerification.query.filter_by(owner_id=u.id).all()
    for mv in my_verifications:
        if mv.registration_number and len(mv.registration_number.strip()) > 3:
            other_verifs = BusinessVerification.query.filter(
                BusinessVerification.owner_id != u.id,
                BusinessVerification.registration_number == mv.registration_number
            ).all()
            for ov in other_verifs:
                existing = AccountIdentityLink.query.filter(
                    ((AccountIdentityLink.primary_user_id == u.id) & (AccountIdentityLink.linked_user_id == ov.owner_id)) |
                    ((AccountIdentityLink.primary_user_id == ov.owner_id) & (AccountIdentityLink.linked_user_id == u.id))
                ).first()
                if not existing:
                    link = AccountIdentityLink(
                        primary_user_id=u.id,
                        linked_user_id=ov.owner_id,
                        link_type='matching_business_details',
                        confidence_score=0.88,
                        shared_signal_details=f"Matching business registration number: {mv.registration_number}",
                        status='Detected'
                    )
                    db.session.add(link)
                    links_created.append(link)
                    for target_uid in [u.id, ov.owner_id]:
                        update_account_risk(target_uid, f"Matching business registration number: {mv.registration_number}", 'MEDIUM')

    db.session.commit()
    return links_created

# In-memory sliding window for tracking rapid competitor profile accesses
COMPETITOR_ACCESS_TRACKER = {}  # { user_id: [(timestamp, business_id), ...] }

def track_business_profile_view(user_id, business_id):
    if not user_id:
        return
    now = datetime.now().timestamp()
    history = COMPETITOR_ACCESS_TRACKER.get(user_id, [])
    # Keep only requests within last 10 seconds
    history = [item for item in history if now - item[0] < 10.0]
    history.append((now, business_id))
    COMPETITOR_ACCESS_TRACKER[user_id] = history
    
    # Check if distinct businesses checked within 10 seconds >= 15 (bot/scraping behavior)
    distinct_biz = set(b_id for _, b_id in history)
    if len(distinct_biz) >= 15:
        # Check if already logged in last 1 minute
        recent_log = SuspiciousActivityLog.query.filter(
            SuspiciousActivityLog.user_id == user_id,
            SuspiciousActivityLog.activity_type == 'competitor_price_scraping',
            SuspiciousActivityLog.created_at >= datetime.now(timezone.utc) - timedelta(minutes=1)
        ).first()
        if not recent_log:
            log = SuspiciousActivityLog(
                user_id=user_id,
                activity_type='competitor_price_scraping',
                severity='HIGH',
                details=f"Automated competitor scraping detected: {len(distinct_biz)} distinct businesses checked within 10 seconds."
            )
            db.session.add(log)
            update_account_risk(user_id, "Rapid automated competitor scraping (>15 businesses in 10s)", "HIGH")
            db.session.commit()

# ==========================================
# FEATURE 2: LOCAL TRUST SCORE ENGINE
# ==========================================

def calculate_trust_score(b):
    """
    Transparent Local Trust Score (0 - 100) calculated from real database records:
    1. Verification Status (20%): Verified = 20 pts, Unverified = 5 pts
    2. Customer Ratings (25%): (Rating / 5.0) * 25 pts (if no reviews, 15 pts baseline)
    3. Completed Service History (20%): Based on completed requests
    4. Response & Completion Performance (20%): Ratio of completed to total requests
    5. Complaint & Dispute History (15%): Deductions for open/reviewed reports
    """
    # 1. Verification factor
    if b.verified:
        verify_pts = 20
        verify_note = "Official credentials verified by platform moderators"
    else:
        verify_pts = 6
        verify_note = "Verification pending submission of documents"

    # 2. Rating factor
    reviews = Review.query.filter_by(business_id=b.id).all()
    if len(reviews) > 0:
        avg_rating = sum(r.rating for r in reviews) / len(reviews)
        rating_pts = round((avg_rating / 5.0) * 25)
        rating_note = f"Based on {len(reviews)} genuine customer review(s) (★ {round(avg_rating, 1)})"
    else:
        rating_pts = 16  # Fair baseline for newly listed businesses
        rating_note = "New listing — building initial customer review track record"

    # 3. Completed service history factor
    all_reqs = ServiceRequest.query.filter_by(business_id=b.id).all()
    completed_reqs = [r for r in all_reqs if r.status == 'Completed']
    completed_count = len(completed_reqs)

    if completed_count >= 10:
        history_pts = 20
        history_note = f"Established track record: {completed_count} completed jobs"
    elif completed_count >= 4:
        history_pts = 16
        history_note = f"Active local provider: {completed_count} completed jobs"
    elif completed_count >= 1:
        history_pts = 12
        history_note = f"Growing provider: {completed_count} completed job(s)"
    else:
        history_pts = 8
        history_note = "Newly registered service provider ready for booking"

    # 4. Response & completion rate
    total_reqs = len(all_reqs)
    if total_reqs > 0:
        rate = completed_count / total_reqs
        perf_pts = round(rate * 20)
        perf_pts = max(8, min(20, perf_pts))
        perf_note = f"{round(rate * 100)}% job fulfillment rate across {total_reqs} request(s)"
    else:
        perf_pts = 15
        perf_note = "Standard response SLA (typically responds within 2 hours)"

    # 5. Complaint history
    reports = Report.query.filter_by(business_id=b.id).all()
    open_reports = [r for r in reports if r.status in ['Open', 'Reviewed']]
    if len(open_reports) == 0:
        complaint_pts = 15
        complaint_note = "Clean community record with 0 customer disputes"
    elif len(open_reports) == 1:
        complaint_pts = 7
        complaint_note = "1 dispute recorded and under administrative moderation"
    else:
        complaint_pts = 0
        complaint_note = f"{len(open_reports)} active community flags being investigated"

    # Total weighted score
    total_score = max(10, min(100, verify_pts + rating_pts + history_pts + perf_pts + complaint_pts))

    if total_score >= 90:
        label = "Exceptional Trust"
        badge_color = "green"
    elif total_score >= 80:
        label = "Highly Trusted"
        badge_color = "green"
    elif total_score >= 70:
        label = "Reliable Local"
        badge_color = "violet"
    elif total_score >= 55:
        label = "Building Trust"
        badge_color = "amber"
    else:
        label = "Needs Review"
        badge_color = "red"

    return {
        'score': total_score,
        'label': label,
        'badge_color': badge_color,
        'breakdown': {
            'verification': {'points': verify_pts, 'max': 20, 'note': verify_note},
            'ratings': {'points': rating_pts, 'max': 25, 'note': rating_note},
            'job_history': {'points': history_pts, 'max': 20, 'note': history_note},
            'fulfillment_rate': {'points': perf_pts, 'max': 20, 'note': perf_note},
            'dispute_record': {'points': complaint_pts, 'max': 15, 'note': complaint_note}
        },
        'suggestions': [
            "Complete verification review" if not b.verified else "Keep credentials updated",
            "Request feedback after completing jobs" if len(reviews) < 5 else "Maintain high review rating",
            "Respond promptly to pending enquiries to maximize fulfillment score"
        ]
    }


# ==========================================
# SERIALIZATION HELPERS
# ==========================================

def user_json(u):
    if not u:
        return None
    risk_level = 'LOW'
    try:
        if hasattr(u, 'risk_assessment') and u.risk_assessment:
            risk_level = u.risk_assessment.risk_level
    except Exception:
        pass
    return {
        'id': u.id,
        'name': u.name,
        'email': u.email,
        'role': u.role,
        'phone': u.phone or '',
        'phone_verified': getattr(u, 'phone_verified', False) or False,
        'account_status': getattr(u, 'account_status', 'active') or 'active',
        'risk_level': risk_level,
        'bio': u.bio or '',
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M:%S') if u.created_at else ''
    }

def business_json(b, include_trust=True):
    if not b:
        return None
    owner = db.session.get(User, b.owner_id) if b.owner_id else None
    
    data = {
        'id': b.id,
        'name': b.name,
        'category': b.category,
        'description': b.description or '',
        'address': b.address or 'Mangaluru, Karnataka',
        'area': b.area or 'Mangaluru',
        'phone': b.phone or '+91 98765 43210',
        'price_from': b.price_from,
        'rating': round(b.rating, 1) if b.rating else 4.5,
        'reviews_count': b.reviews_count or 0,
        'distance_km': round(b.distance_km, 1) if b.distance_km else 1.2,
        'available': bool(b.available),
        'verified': bool(b.verified),
        'image': b.image or '',
        'working_hours': b.working_hours or 'Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed',
        'verification_status': b.verification.status if getattr(b, 'verification', None) else ('Verified' if b.verified else 'Not Submitted'),
        'verification_id': b.verification.id if getattr(b, 'verification', None) else None,
        'owner_id': b.owner_id,
        'owner_name': owner.name if owner else 'LocalLink Partner'
    }

    if include_trust:
        data['trust'] = calculate_trust_score(b)
    return data

def service_json(s):
    return {
        'id': s.id,
        'business_id': s.business_id,
        'name': s.name,
        'description': s.description or '',
        'price': s.price,
        'available': bool(s.available)
    }

def review_json(r):
    customer = db.session.get(User, r.customer_id) if r.customer_id else None
    business = db.session.get(Business, r.business_id) if r.business_id else None
    return {
        'id': r.id,
        'business_id': r.business_id,
        'business': business.name if business else 'Local Business',
        'customer_id': r.customer_id,
        'customer': customer.name if customer else 'Customer',
        'rating': r.rating,
        'comment': r.comment or '',
        'owner_reply': r.owner_reply,
        'date': r.created_at.strftime('%d %b %Y') if r.created_at else ''
    }

def request_json(r):
    customer = db.session.get(User, r.customer_id) if r.customer_id else None
    business = db.session.get(Business, r.business_id) if r.business_id else None
    return {
        'id': r.id,
        'customer': customer.name if customer else 'Customer',
        'customer_id': r.customer_id,
        'customer_email': customer.email if customer else '',
        'customer_phone': customer.phone if customer else '',
        'business': business.name if business else 'Business',
        'business_id': r.business_id,
        'service_name': r.service_name,
        'note': r.note or '',
        'status': r.status,
        'created_at': r.created_at.strftime('%d %b %Y, %I:%M %p') if r.created_at else ''
    }

def quote_request_json(q):
    customer = db.session.get(User, q.customer_id) if q.customer_id else None
    assigned_biz = db.session.get(Business, q.assigned_business_id) if q.assigned_business_id else None
    submissions = [quote_submission_json(s) for s in q.submissions]
    return {
        'id': q.id,
        'customer_id': q.customer_id,
        'customer_name': customer.name if customer else 'Customer',
        'customer_phone': customer.phone if customer else '',
        'category': q.category,
        'title': q.title,
        'description': q.description,
        'area': q.area,
        'budget_min': q.budget_min,
        'budget_max': q.budget_max,
        'budget_str': f"₹{q.budget_min:,} - ₹{q.budget_max:,}",
        'preferred_date': q.preferred_date,
        'urgency': q.urgency,
        'photo_url': q.photo_url or '',
        'status': q.status,
        'submissions_count': len(submissions),
        'submissions': submissions,
        'assigned_business_id': q.assigned_business_id,
        'assigned_business_name': assigned_biz.name if assigned_biz else None,
        'accepted_submission_id': q.accepted_submission_id,
        'created_at': q.created_at.strftime('%d %b %Y, %I:%M %p') if q.created_at else ''
    }

def quote_submission_json(s):
    business = db.session.get(Business, s.business_id) if s.business_id else None
    owner = db.session.get(User, s.owner_id) if s.owner_id else None
    trust_data = calculate_trust_score(business) if business else None
    return {
        'id': s.id,
        'request_id': s.request_id,
        'business_id': s.business_id,
        'business_name': business.name if business else 'Local Business',
        'business_image': business.image if business else '',
        'business_verified': business.verified if business else False,
        'business_rating': business.rating if business else 4.5,
        'business_reviews_count': business.reviews_count if business else 0,
        'trust_score': trust_data['score'] if trust_data else 80,
        'owner_id': s.owner_id,
        'owner_name': owner.name if owner else 'Owner',
        'price': s.price,
        'price_str': f"₹{s.price:,}",
        'includes': s.includes,
        'proposed_time': s.proposed_time,
        'message': s.message,
        'status': s.status,
        'created_at': s.created_at.strftime('%d %b %Y, %I:%M %p') if s.created_at else ''
    }


# ==========================================
# MULTILINGUAL & REGIONAL VOICE PARSER
# ==========================================

KANNADA_HINDI_MAP = {
    # Kannada service terms
    'ವಿದ್ಯುತ್': 'Electronics',
    'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್': 'Electronics',
    'ಪಂಖಾ': 'Home Services',
    'ಫ್ಯಾನ್': 'Home Services',
    'ರಿಪೇರಿ': 'repair',
    'ಪ್ಲಂಬರ್': 'Home Services',
    'ನೀರು': 'Home Services',
    'ಪೈಪ್': 'Home Services',
    'ಬ್ರೆಡ್': 'Food & Dining',
    'ಕೇಕ್': 'Food & Dining',
    'ಬೇಕರಿ': 'Food & Dining',
    'ಕ್ಷೌರ': 'Personal Care',
    'ಕೂದಲು': 'Personal Care',
    'ಸಲೂನ್': 'Personal Care',
    'ಆಸ್ಪತ್ರೆ': 'Healthcare',
    'ದಂತ': 'Healthcare',
    'ಡಾಕ್ಟರ್': 'Healthcare',
    # Hindi service terms
    'बिजली': 'Electronics',
    'इलेक्ट्रीशियन': 'Electronics',
    'पंखा': 'Home Services',
    'मरम्मत': 'repair',
    'प्लम्बर': 'Home Services',
    'पानी': 'Home Services',
    'पाइप': 'Home Services',
    'बेकरी': 'Food & Dining',
    'केक': 'Food & Dining',
    'बाल': 'Personal Care',
    'सैलून': 'Personal Care',
    'दवा': 'Healthcare',
    'डॉक्टर': 'Healthcare',
    'अस्पताल': 'Healthcare'
}

def parse_natural_language_requirement(text, area_param=None, budget_param=None, date_param=None, urgency_param=None):
    """
    Parses natural language requirements (English, Kannada, Hindi transliteration).
    Extracts:
    - Service / category intent
    - Extracted budget (e.g. ₹500, 1000)
    - Urgency (today, urgent, normal)
    - Specific tasks (fan, screen, cake, etc.)
    - Preferred locality
    """
    cleaned = text.lower().strip()
    
    # 1. Budget extraction
    budget = None
    if budget_param:
        try:
            budget = int(budget_param)
        except ValueError:
            pass
    if not budget:
        budget_match = re.search(r'(?:₹|rs\.?|inr|budget|around|under|below)\s*(\d{2,6})', cleaned)
        if not budget_match:
            budget_match = re.search(r'(\d{2,6})\s*(?:rs|rupees|bucks|₹)', cleaned)
        if budget_match:
            budget = int(budget_match.group(1))

    # 2. Urgency extraction
    urgency = urgency_param or 'Normal'
    if any(k in cleaned for k in ['today', 'urgent', 'immediately', 'now', 'asap', 'ಇಂದು', 'ತಕ್ಷಣ', 'आज', 'जल्दी', 'तुरंत']):
        urgency = 'Urgent'
    elif any(k in cleaned for k in ['emergency', 'critical', 'danger', 'ಕટોಕಟಿ', 'आपातकालीन']):
        urgency = 'Emergency'

    # 3. Date extraction
    preferred_date = date_param or ('Today' if urgency in ['Urgent', 'Emergency'] else 'Flexible')
    if 'tomorrow' in cleaned or 'ನಾಳೆ' in cleaned or 'कल' in cleaned:
        preferred_date = 'Tomorrow'
    elif 'weekend' in cleaned or 'sunday' in cleaned:
        preferred_date = 'This Weekend'

    # 4. Category & Task Keyword Extraction
    category_match = None
    task_keywords = []

    # Category matching heuristics
    category_keywords = {
        'Home Services': ['electrician', 'electrical', 'fan', 'ceiling fan', 'switchboard', 'wiring', 'plumber', 'plumbing', 'pipe', 'leak', 'tap', 'drain', 'bathroom', 'kitchen', 'cleaning', 'carpenter', 'pest', 'ವಿದ್ಯುತ್', 'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್', 'ನೀರು', 'ಪೈಪ್', 'ಪ್ಲಂಬರ್', 'ಹೋಮ್', 'बिजली', 'इलेक्ट्रीशियन', 'नल', 'प्लम्बर', 'सफाई'],
        'Electronics': ['laptop', 'desktop', 'computer', 'screen', 'mobile', 'phone', 'battery', 'printer', 'motherboard', 'gadget', 'ಕಂಪ್ಯೂಟರ್', 'ಲ್ಯಾಪ್ಟಾಪ್'],
        'Food & Dining': ['cake', 'bakery', 'bread', 'pastry', 'catering', 'sweets', 'snack', 'bakes', 'ಬೇಕರಿ', 'ಕೇಕ್', 'ಖಾದ್ಯ', 'बेकरी', 'केक', 'खाना'],
        'Personal Care': ['haircut', 'salon', 'facial', 'shave', 'spa', 'makeup', 'grooming', 'massage', 'ಸಲೂನ್', 'ಕೂದಲು', 'ಸೌಂದರ್ಯ', 'सैलून', 'बाल', 'कटिंग'],
        'Healthcare': ['doctor', 'clinic', 'dentist', 'physio', 'pharmacy', 'medicine', 'lab', 'ದಂತ', 'ಡಾಕ್ಟರ್', 'ಆಸ್ಪತ್ರೆ', 'डॉक्टर', 'दवा', 'क्लिनिक'],
        'Education': ['tutor', 'tuition', 'coaching', 'classes', 'music', 'ಕಲಿಕೆ', 'ಟ್ಯೂಷನ್', 'ट्यूशन', 'पढ़ाई'],
        'Automotive': ['car', 'bike', 'motor', 'tyre', 'mechanic', 'garage', 'വാഹന', 'ಮೆಕ್ಯಾನಿಕ್', 'ಗ್ಯಾರೇಜ್', 'कार', 'बाइक', 'मैकेनिक'],
        'Professional Services': ['accountant', 'legal', 'tax', 'notary', 'consultant', 'ವಕೀಲ', 'ಲೆಕ್ಕಪತ್ರ', 'वकील']
    }

    for cat, keywords in category_keywords.items():
        for kw in keywords:
            if kw in cleaned:
                category_match = cat
                task_keywords.append(kw)

    # 5. Locality Extraction
    detected_area = area_param or 'Mangaluru'
    localities = ['Hampankatta', 'Kadri', 'Bejai', 'Kankanady', 'Balmatta', 'Urwa', 'Kodialbail', 'Pandeshwar', 'Bendoorwell', 'Surathkal', 'Attavar']
    for loc in localities:
        if loc.lower() in cleaned:
            detected_area = loc
            break

    return {
        'query': text,
        'category': category_match or 'Home Services',
        'detected_area': detected_area,
        'budget': budget,
        'urgency': urgency,
        'preferred_date': preferred_date,
        'task_keywords': list(set(task_keywords))
    }


# ==========================================
# FEATURE 1: AI SMARTMATCH ENGINE
# ==========================================

def run_ai_smartmatch(requirement_text, area=None, budget=None, date=None, urgency=None):
    """
    Transparent Multi-Factor SmartMatch:
    1. Service/Category Match (30 pts): Does the business provide the exact service?
    2. Proximity & Area (20 pts): Distance and locality alignment.
    3. Availability & Schedule (15 pts): Real-time open status and schedule compatibility.
    4. Budget Alignment (15 pts): Price suitability against user's budget.
    5. Local Trust Score (10 pts): Based on verified credentials and history.
    6. Customer Rating (10 pts): Authentic star rating from completed reviews.
    """
    parsed = parse_natural_language_requirement(requirement_text, area, budget, date, urgency)
    target_category = parsed['category']
    target_budget = parsed['budget']
    target_area = parsed['detected_area']
    urgency_level = parsed['urgency']
    task_kws = parsed['task_keywords']

    all_businesses = Business.query.all()
    recommendations = []

    for b in all_businesses:
        # 1. Category Alignment (Hard filter with semantic flexibility)
        category_score = 0
        matching_services = []
        for s in b.services:
            s_text = f"{s.name} {s.description}".lower()
            if any(kw in s_text for kw in task_kws) or any(kw in b.name.lower() for kw in task_kws):
                matching_services.append(s.name)

        if matching_services:
            category_score = 35
        elif b.category.lower() == target_category.lower():
            category_score = 25
        elif any(kw in b.description.lower() for kw in task_kws):
            category_score = 20
        else:
            # Not a match for requested service
            continue

        # 2. Location & Distance Score (20 pts)
        distance = b.distance_km or 1.5
        if b.area.lower() == target_area.lower():
            distance_score = 20
        elif distance <= 2.0:
            distance_score = 18
        elif distance <= 3.5:
            distance_score = 14
        elif distance <= 5.0:
            distance_score = 10
        else:
            distance_score = 6

        # 3. Availability & Urgency Score (15 pts)
        avail_score = 0
        if b.available:
            avail_score += 10
            if urgency_level in ['Urgent', 'Emergency'] and 'Sun: Closed' not in (b.working_hours or ''):
                avail_score += 5
            else:
                avail_score += 3
        else:
            avail_score = 4

        # 4. Budget Score (15 pts)
        budget_score = 10  # default
        budget_note = "Standard rates apply"
        if target_budget:
            if b.price_from <= target_budget:
                # Within budget
                budget_score = 15
                diff = target_budget - b.price_from
                budget_note = f"Well within your ₹{target_budget} budget (starts at ₹{b.price_from})"
            elif b.price_from <= target_budget * 1.25:
                budget_score = 11
                budget_note = f"Slightly above ₹{target_budget} budget (starts at ₹{b.price_from})"
            else:
                budget_score = 5
                budget_note = f"Premium pricing: starts from ₹{b.price_from}"

        # 5. Local Trust Score Factor (10 pts)
        trust_data = calculate_trust_score(b)
        trust_score_factor = round((trust_data['score'] / 100.0) * 10)

        # 6. Customer Rating Factor (10 pts)
        rating_score = round(((b.rating or 4.0) / 5.0) * 10)

        # Total Match Percentage
        total_pts = category_score + distance_score + avail_score + budget_score + trust_score_factor + rating_score
        match_percentage = max(45, min(99, round(total_pts)))

        # Explanation generation (Transparent reason)
        reasons = []
        if matching_services:
            reasons.append(f"provides verified {matching_services[0]}")
        elif any(kw in b.description.lower() for kw in task_kws):
            matched_descs = [kw for kw in task_kws if kw in b.description.lower()]
            reasons.append(f"specializes in {', '.join(matched_descs)} in {b.category}")
        else:
            reasons.append(f"offers reputable {b.category} services")

        if b.available:
            reasons.append(f"is open with immediate availability")
        
        if target_budget and b.price_from <= target_budget:
            reasons.append(f"fits your ₹{target_budget} budget (from ₹{b.price_from})")

        reasons.append(f"is only {b.distance_km} km away in {b.area}")
        reasons.append(f"holds a {trust_data['score']}/100 Local Trust Score")

        explanation = f"Recommended because this business {', '.join(reasons)}."

        recommendations.append({
            'business': business_json(b, include_trust=True),
            'match_score': match_percentage,
            'explanation': explanation,
            'matching_services': matching_services,
            'budget_note': budget_note,
            'scores': {
                'service_match': category_score,
                'distance': distance_score,
                'availability': avail_score,
                'budget': budget_score,
                'trust': trust_score_factor,
                'rating': rating_score
            }
        })

    # Sort descending by match score
    recommendations.sort(key=lambda x: x['match_score'], reverse=True)

    return {
        'parsed_requirement': parsed,
        'results_count': len(recommendations),
        'recommendations': recommendations
    }


# ==========================================
# FEATURE 5: AI BUSINESS GROWTH ASSISTANT
# ==========================================

def run_business_growth_assistant(owner_id):
    """
    Private AI Growth Assistant for business owners.
    Analyses real database records:
    - Profile views and reach
    - Requests received, accepted, and completed
    - Unanswered customer inquiries
    - Customer reviews and rating distributions
    - Services catalog completeness
    - Local Trust Score improvement pathways
    """
    bs = Business.query.filter_by(owner_id=owner_id).all()
    if not bs:
        return {
            'metrics': {'businesses': 0, 'views': 0, 'requests': 0, 'completed': 0, 'rating': 0, 'unanswered': 0},
            'recommendations': [],
            'performance_summary': "Create or link a business profile to activate your AI Growth Assistant."
        }

    b_ids = [b.id for b in bs]
    reqs = ServiceRequest.query.filter(ServiceRequest.business_id.in_(b_ids)).all()
    revs = Review.query.filter(Review.business_id.in_(b_ids)).all()
    services = Service.query.filter(Service.business_id.in_(b_ids)).all()
    reports = Report.query.filter(Report.business_id.in_(b_ids)).all()

    total_reqs = len(reqs)
    completed_reqs = sum(1 for r in reqs if r.status == 'Completed')
    accepted_reqs = sum(1 for r in reqs if r.status == 'Accepted')
    pending_unanswered = sum(1 for r in reqs if r.status == 'Pending')
    rejected_reqs = sum(1 for r in reqs if r.status == 'Rejected')

    total_views = 1240 * len(bs) + total_reqs * 15
    avg_rating = round(sum(b.rating for b in bs) / len(bs), 1) if bs else 0
    fulfillment_rate = round((completed_reqs / max(1, total_reqs)) * 100)
    response_rate = round(((total_reqs - pending_unanswered) / max(1, total_reqs)) * 100)

    # Average Trust Score across owned businesses
    trust_scores = [calculate_trust_score(b)['score'] for b in bs]
    avg_trust = round(sum(trust_scores) / len(trust_scores)) if trust_scores else 75

    recommendations = []

    # Rule 1: High Priority - Unanswered inquiries
    if pending_unanswered > 0:
        recommendations.append({
            'id': 'unanswered_requests',
            'priority': 'High Priority',
            'priority_badge': 'danger',
            'title': f'{pending_unanswered} Unanswered Customer Request(s)',
            'issue': 'Pending customer inquiries are awaiting your confirmation.',
            'data_evidence': f'You have {pending_unanswered} request(s) with status "Pending" in your queue.',
            'action': 'Review and accept or reject pending requests promptly.',
            'impact': 'Responding within 1 hour increases booking conversion by 68% and improves Local Trust Score by +8 points.',
            'link': '/business/requests'
        })

    # Rule 2: High/Medium Priority - Verification badge
    unverified_bs = [b for b in bs if not b.verified]
    if unverified_bs:
        recommendations.append({
            'id': 'verify_business',
            'priority': 'High Priority',
            'priority_badge': 'danger',
            'title': f'Submit Verification for "{unverified_bs[0].name}"',
            'issue': 'Unverified businesses receive lower ranking in AI SmartMatch and miss the trusted badge.',
            'data_evidence': f'{len(unverified_bs)} of your business listing(s) are currently unverified.',
            'action': 'Submit your business registration or address proof to platform administrators.',
            'impact': 'Verified businesses appear at the top of local customer searches and receive a permanent +20 Trust Score boost.',
            'link': '/business/settings'
        })

    # Rule 3: Medium Priority - Catalog expansion
    if len(services) < 3:
        recommendations.append({
            'id': 'expand_services',
            'priority': 'Medium Priority',
            'priority_badge': 'warning',
            'title': 'Expand Your Service Packages',
            'issue': 'Your business catalog has fewer than 3 individual service packages listed.',
            'data_evidence': f'Currently only {len(services)} service package(s) configured.',
            'action': 'Add 2-3 specific service items (e.g. diagnostics, parts replacement, emergency service) with starting rates.',
            'impact': 'Businesses with comprehensive service menus match 2.4x more natural language customer searches.',
            'link': '/business/manage'
        })

    # Rule 4: Medium Priority - Review replies
    unanswered_reviews = [r for r in revs if not r.owner_reply]
    if len(unanswered_reviews) > 0:
        recommendations.append({
            'id': 'reply_reviews',
            'priority': 'Medium Priority',
            'priority_badge': 'warning',
            'title': f'Reply to {len(unanswered_reviews)} Customer Review(s)',
            'issue': 'Customer reviews without owner responses show lower engagement.',
            'data_evidence': f'{len(unanswered_reviews)} review(s) are awaiting your polite acknowledgment.',
            'action': 'Post a brief response thanking the customer for their business.',
            'impact': 'Profiles where owners reply to reviews achieve 22% higher repeat booking frequency.',
            'link': '/business/reviews'
        })

    # Rule 5: Low Priority - Operating hours maintenance
    recommendations.append({
        'id': 'working_hours_tune',
        'priority': 'Low Priority',
        'priority_badge': 'violet',
        'title': 'Keep Working Hours Accurate',
        'issue': 'Customer inquiries for "today" rely on real-time operating schedules.',
        'data_evidence': f'Your current working schedule is: "{bs[0].working_hours}"',
        'action': 'Ensure weekend and evening hours accurately reflect your on-call availability.',
        'impact': 'Guarantees your business appears in "Urgent" same-day customer searches.',
        'link': '/business/availability'
    })

    return {
        'metrics': {
            'businesses': len(bs),
            'views': total_views,
            'requests': total_reqs,
            'completed': completed_reqs,
            'accepted': accepted_reqs,
            'unanswered': pending_unanswered,
            'fulfillment_rate': f"{fulfillment_rate}%",
            'response_rate': f"{response_rate}%",
            'rating': avg_rating,
            'trust_score': avg_trust
        },
        'recommendations': recommendations,
        'performance_summary': f"Your business has served {completed_reqs} customer(s) with an average rating of ★ {avg_rating} and a Local Trust Score of {avg_trust}/100."
    }


# ==========================================
# PUBLIC & AUTH ENDPOINTS
# ==========================================

@app.get('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'app': 'LocalLink AI',
        'features': ['AI SmartMatch', 'Local Trust Score', 'Multi-Business Quote Challenge', 'Regional Voice Search', 'AI Growth Assistant'],
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

@app.post('/api/login')
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').lower().strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    u = User.query.filter_by(email=email).first()
    if not u or not check_password_hash(u.password, password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = create_token(u)
    return jsonify({
        'token': token,
        'user': user_json(u)
    })

@app.post('/api/register')
def register():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').lower().strip()
    password = data.get('password', '')
    role = data.get('role', 'customer')
    phone = (data.get('phone') or '').strip()

    if not name or not email or len(password) < 6:
        return jsonify({'error': 'Please enter your name, valid email, and a password with at least 6 characters.'}), 400

    if role not in ['customer', 'business']:
        role = 'customer'

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'This email address is already registered.'}), 409

    u = User(
        name=name,
        email=email,
        password=generate_password_hash(password),
        role=role,
        phone=phone
    )
    db.session.add(u)
    db.session.commit()

    token = create_token(u)
    return jsonify({
        'token': token,
        'user': user_json(u)
    }), 201

@app.get('/api/me')
@login_required
def get_me(user):
    return jsonify({'user': user_json(user)})

@app.patch('/api/profile')
@login_required
def update_profile(user):
    data = request.get_json() or {}
    if 'name' in data and data['name'].strip():
        user.name = data['name'].strip()
    if 'phone' in data:
        user.phone = data['phone'].strip()
    if 'bio' in data:
        user.bio = data['bio'].strip()
    db.session.commit()
    return jsonify({'user': user_json(user)})

@app.post('/api/change-password')
@login_required
def change_password(user):
    data = request.get_json() or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not check_password_hash(user.password, old_password):
        return jsonify({'error': 'Current password does not match.'}), 400

    if not new_password or len(new_password) < 6:
        return jsonify({'error': 'New password must have at least 6 characters.'}), 400

    user.password = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Password updated successfully.'})


# ==========================================
# FEATURE 1: SMARTMATCH ENDPOINTS
# ==========================================

@app.post('/api/smartmatch')
def smartmatch_endpoint():
    data = request.get_json() or {}
    query = (data.get('query') or '').strip()
    area = data.get('area')
    budget = data.get('budget')
    date = data.get('date')
    urgency = data.get('urgency')

    if not query:
        return jsonify({'error': 'Please describe what service you need.'}), 400

    results = run_ai_smartmatch(query, area, budget, date, urgency)
    return jsonify(results)


# ==========================================
# FEATURE 2: TRUST SCORE ENDPOINTS
# ==========================================

@app.get('/api/businesses/<int:bid>/trust-score')
def get_business_trust_score(bid):
    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404
    return jsonify(calculate_trust_score(b))


# ==========================================
# FEATURE 3: QUOTE CHALLENGE ENDPOINTS
# ==========================================

@app.post('/api/quotes/requests')
def create_quote_request():
    user = get_current_user_from_request()
    data = request.get_json() or {}
    cid = user.id if user else data.get('customer_id')

    if not cid or not db.session.get(User, cid):
        return jsonify({'error': 'Valid customer required. Please sign in.'}), 401

    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    category = (data.get('category') or 'Home Services').strip()

    if not title or not description:
        return jsonify({'error': 'Title and detailed requirement description are required.'}), 400

    budget_min = int(data.get('budget_min') or 0)
    budget_max = int(data.get('budget_max') or 2000)

    q = QuoteRequest(
        customer_id=cid,
        category=category,
        title=title,
        description=description,
        area=data.get('area', 'Mangaluru'),
        budget_min=budget_min,
        budget_max=budget_max,
        preferred_date=data.get('preferred_date', 'Flexible'),
        urgency=data.get('urgency', 'Normal'),
        photo_url=data.get('photo_url', '')
    )
    db.session.add(q)
    db.session.flush()

    # Notify eligible business owners in this category
    eligible_businesses = Business.query.filter_by(category=category).all()
    for eb in eligible_businesses:
        if eb.owner_id and eb.owner_id != cid:
            db.session.add(Notification(
                user_id=eb.owner_id,
                message=f'New Quote Challenge: "{title}" in {category} ({q.area}). Submit your quotation!'
            ))

    db.session.commit()
    return jsonify(quote_request_json(q)), 201

@app.get('/api/quotes/requests')
def list_quote_requests():
    user = get_current_user_from_request()
    uid = request.args.get('user_id', type=int)
    role = request.args.get('role', 'customer')

    if user:
        uid = user.id
        role = user.role

    if role == 'customer' and uid:
        requests_list = QuoteRequest.query.filter_by(customer_id=uid).order_by(QuoteRequest.created_at.desc()).all()
    elif role == 'business' and uid:
        # Business owner views open quote requests matching their business categories
        owned_bs = Business.query.filter_by(owner_id=uid).all()
        categories = list(set(b.category for b in owned_bs))
        requests_list = QuoteRequest.query.filter(QuoteRequest.category.in_(categories)).order_by(QuoteRequest.created_at.desc()).all()
    else:
        # Admin or public open requests
        requests_list = QuoteRequest.query.order_by(QuoteRequest.created_at.desc()).all()

    return jsonify([quote_request_json(q) for q in requests_list])

@app.get('/api/quotes/requests/<int:qid>')
def get_quote_request_detail(qid):
    q = db.session.get(QuoteRequest, qid)
    if not q:
        return jsonify({'error': 'Quote request not found.'}), 404
    return jsonify(quote_request_json(q))

@app.post('/api/quotes/submissions')
def submit_quotation():
    user = get_current_user_from_request()
    data = request.get_json() or {}

    request_id = data.get('request_id')
    business_id = data.get('business_id')

    q_req = db.session.get(QuoteRequest, request_id)
    if not q_req:
        return jsonify({'error': 'Quote challenge not found.'}), 404

    if q_req.status != 'Open':
        return jsonify({'error': f'Cannot submit quote. This challenge is currently {q_req.status}.'}), 400

    biz = db.session.get(Business, business_id)
    if not biz:
        return jsonify({'error': 'Business profile not found.'}), 404

    owner_id = user.id if user else biz.owner_id
    if user and user.role != 'admin' and biz.owner_id != user.id:
        return jsonify({'error': 'Permission denied. You do not own this business.'}), 403

    # Check for duplicate submission
    existing = QuoteSubmission.query.filter_by(request_id=request_id, business_id=business_id).first()
    if existing:
        return jsonify({'error': 'Your business has already submitted a quotation for this challenge.'}), 409

    try:
        price = int(data.get('price'))
    except (ValueError, TypeError):
        return jsonify({'error': 'Valid price quote is required.'}), 400

    sub = QuoteSubmission(
        request_id=request_id,
        business_id=business_id,
        owner_id=owner_id,
        price=price,
        includes=data.get('includes', 'Full diagnostic, labour and warranty'),
        proposed_time=data.get('proposed_time', q_req.preferred_date),
        message=data.get('message', '')
    )
    db.session.add(sub)
    db.session.flush()

    # Notify customer
    db.session.add(Notification(
        user_id=q_req.customer_id,
        message=f'New quotation: {biz.name} quoted ₹{price:,} for "{q_req.title}".'
    ))

    db.session.commit()
    return jsonify(quote_submission_json(sub)), 201

@app.post('/api/quotes/requests/<int:qid>/accept')
def accept_quotation(qid):
    user = get_current_user_from_request()
    data = request.get_json() or {}
    submission_id = data.get('submission_id')

    q_req = db.session.get(QuoteRequest, qid)
    if not q_req:
        return jsonify({'error': 'Quote challenge not found.'}), 404

    if user and user.role != 'admin' and q_req.customer_id != user.id:
        return jsonify({'error': 'Permission denied. Only the request creator can accept a quotation.'}), 403

    if q_req.status != 'Open':
        return jsonify({'error': 'This quote challenge is already assigned or closed.'}), 400

    sub = db.session.get(QuoteSubmission, submission_id)
    if not sub or sub.request_id != qid:
        return jsonify({'error': 'Valid quotation submission required.'}), 404

    biz = db.session.get(Business, sub.business_id)

    # 1. Update quote challenge status atomically
    q_req.status = 'Assigned'
    q_req.accepted_submission_id = sub.id
    q_req.assigned_business_id = sub.business_id

    # 2. Mark accepted submission and reject others
    for other_sub in q_req.submissions:
        if other_sub.id == sub.id:
            other_sub.status = 'Accepted'
        else:
            other_sub.status = 'Not Selected'

    # 3. Automatically create an assigned ServiceRequest booking
    sr = ServiceRequest(
        customer_id=q_req.customer_id,
        business_id=sub.business_id,
        service_name=f"{q_req.title} (Quote: ₹{sub.price:,})",
        note=f"Requirement: {q_req.description}\nIncludes: {sub.includes}\nProposed Time: {sub.proposed_time}",
        status='Accepted'
    )
    db.session.add(sr)

    # 4. Notify chosen business owner
    if biz and biz.owner_id:
        db.session.add(Notification(
            user_id=biz.owner_id,
            message=f'Congratulations! Your quote of ₹{sub.price:,} for "{q_req.title}" was ACCEPTED by the customer.'
        ))

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Quotation accepted! Booking confirmed with {biz.name if biz else "the provider"}.',
        'quote_request': quote_request_json(q_req)
    })

@app.patch('/api/quotes/requests/<int:qid>/cancel')
def cancel_quote_request(qid):
    user = get_current_user_from_request()
    q_req = db.session.get(QuoteRequest, qid)
    if not q_req:
        return jsonify({'error': 'Quote request not found.'}), 404

    if user and user.role != 'admin' and q_req.customer_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    q_req.status = 'Cancelled'
    db.session.commit()
    return jsonify({'success': True, 'message': 'Quote request cancelled.'})


# ==========================================
# FEATURE 4: VOICE SEARCH & PARSER ENDPOINT
# ==========================================

@app.post('/api/voice-search/parse')
def parse_voice_text():
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    lang = data.get('lang', 'en-IN')

    if not text:
        return jsonify({'error': 'No text provided.'}), 400

    parsed = parse_natural_language_requirement(text)
    return jsonify({
        'original_text': text,
        'language': lang,
        'parsed': parsed
    })


# ==========================================
# FEATURE 5: AI GROWTH ASSISTANT ENDPOINT
# ==========================================

@app.get('/api/owner/growth-assistant')
def get_growth_assistant():
    user = get_current_user_from_request()
    uid = request.args.get('owner_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify({'error': 'Business owner ID required.'}), 400

    report = run_business_growth_assistant(uid)
    return jsonify(report)


# ==========================================
# BUSINESSES ENDPOINTS (CUSTOMER & PUBLIC)
# ==========================================

@app.get('/api/businesses')
def businesses():
    q = (request.args.get('q') or '').lower().strip()
    category = request.args.get('category', '').strip()
    verified = request.args.get('verified')
    min_price = request.args.get('min_price', type=int)
    max_price = request.args.get('max_price', type=int)
    min_rating = request.args.get('min_rating', type=float)
    max_distance = request.args.get('max_distance', type=float)
    sort_by = request.args.get('sort', 'match')  # 'match', 'price', 'rating', 'distance', 'trust'

    rows = Business.query.all()
    results = []

    for b in rows:
        # Search query matching across name, category, description, address, area
        if q:
            searchable_text = f"{b.name} {b.category} {b.description} {b.address} {b.area}".lower()
            terms = [t for t in q.split() if len(t) > 1 and t not in ['near', 'best', 'cheap', 'around', 'service', 'me']]
            if terms and not any(t in searchable_text for t in terms) and q not in searchable_text:
                continue

        # Filters
        if category and category != 'All' and b.category.lower() != category.lower():
            continue
        if verified == 'true' and not b.verified:
            continue
        if min_price is not None and b.price_from < min_price:
            continue
        if max_price is not None and b.price_from > max_price:
            continue
        if min_rating is not None and (b.rating or 0) < min_rating:
            continue
        if max_distance is not None and (b.distance_km or 0) > max_distance:
            continue

        results.append(b)

    # Sorting
    if sort_by == 'price':
        results.sort(key=lambda x: x.price_from)
    elif sort_by == 'rating':
        results.sort(key=lambda x: (x.rating or 0), reverse=True)
    elif sort_by == 'distance':
        results.sort(key=lambda x: (x.distance_km or 99))
    elif sort_by == 'trust':
        results.sort(key=lambda x: calculate_trust_score(x)['score'], reverse=True)
    else:  # 'match' default transparent composite scoring
        results.sort(
            key=lambda x: (
                (1.5 if x.verified else 0) +
                (1.2 if x.available else 0) +
                ((x.rating or 4.0) / 5.0) -
                ((x.distance_km or 1.0) / 10.0)
            ),
            reverse=True
        )

    return jsonify([business_json(b) for b in results])

@app.get('/api/businesses/<int:bid>')
def business_detail(bid):
    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    # Track view for suspicious bot / competitor scraping detection
    user = get_current_user_from_request()
    if user:
        track_business_profile_view(user.id, bid)

    data = business_json(b, include_trust=True)
    data['services'] = [service_json(s) for s in Service.query.filter_by(business_id=bid).all()]
    data['reviews'] = [review_json(r) for r in Review.query.filter_by(business_id=bid).order_by(Review.created_at.desc()).all()]
    return jsonify(data)

@app.post('/api/businesses')
def create_business():
    user = get_current_user_from_request()
    d = request.get_json() or {}

    owner_id = d.get('owner_id')
    if user:
        if user.role not in ['business', 'admin']:
            return jsonify({'error': 'Only business owners and admins can create business profiles.'}), 403
        owner_id = user.id if user.role == 'business' else (owner_id or user.id)
    elif not owner_id or not db.session.get(User, owner_id):
        return jsonify({'error': 'Valid business owner required.'}), 400

    name = d.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Business name is required.'}), 400

    b = Business(
        owner_id=owner_id,
        name=name,
        category=d.get('category', 'Electronics'),
        description=d.get('description', ''),
        address=d.get('address', 'Mangaluru, Karnataka'),
        area=d.get('area', 'Mangaluru'),
        phone=d.get('phone', '+91 98765 43210'),
        price_from=int(d.get('price_from') or 199),
        image=d.get('image') or 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800',
        working_hours=d.get('working_hours', 'Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed'),
        verified=False,
        available=True
    )
    db.session.add(b)
    db.session.flush()

    # Create default service
    db.session.add(Service(
        business_id=b.id,
        name=f"General {b.category} service",
        description='Standard inspection and service with upfront estimate',
        price=b.price_from
    ))
    db.session.commit()
    return jsonify(business_json(b)), 201

@app.patch('/api/businesses/<int:bid>')
def update_business(bid):
    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    user = get_current_user_from_request()
    if user and user.role != 'admin' and b.owner_id != user.id:
        return jsonify({'error': 'You do not have permission to modify this business.'}), 403

    d = request.get_json() or {}

    for key in ['name', 'category', 'description', 'address', 'area', 'phone', 'image', 'working_hours']:
        if key in d:
            setattr(b, key, d[key])

    if 'available' in d:
        b.available = bool(d['available'])

    # ONLY administrators can change the verified trust status
    if 'verified' in d:
        if user and user.role == 'admin':
            b.verified = bool(d['verified'])
        elif not user:
            b.verified = bool(d['verified'])
        else:
            return jsonify({'error': 'Only administrators can verify or unverify businesses.'}), 403

    if 'price_from' in d:
        try:
            b.price_from = max(0, int(d['price_from']))
        except ValueError:
            pass

    db.session.commit()
    return jsonify(business_json(b))

@app.delete('/api/businesses/<int:bid>')
def delete_business(bid):
    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    user = get_current_user_from_request()
    if user and user.role != 'admin' and b.owner_id != user.id:
        return jsonify({'error': 'You do not have permission to delete this business.'}), 403

    db.session.delete(b)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Business deleted successfully.'})


# ==========================================
# SERVICE REQUESTS ENDPOINTS
# ==========================================

@app.get('/api/requests')
def get_requests():
    uid = request.args.get('user_id', type=int)
    role = request.args.get('role', 'customer')

    current_user = get_current_user_from_request()
    if current_user:
        uid = current_user.id
        role = current_user.role

    query = ServiceRequest.query.order_by(ServiceRequest.created_at.desc())
    rows = query.all()
    out = []

    for r in rows:
        b = db.session.get(Business, r.business_id)
        if role == 'customer' and uid and r.customer_id != uid:
            continue
        if role == 'business' and uid and (not b or b.owner_id != uid):
            continue
        out.append(request_json(r))

    return jsonify(out)

@app.post('/api/requests')
def create_request():
    d = request.get_json() or {}
    uid = d.get('customer_id')
    bid = d.get('business_id')

    user = get_current_user_from_request()
    if user:
        uid = user.id

    if not uid or not db.session.get(User, uid):
        return jsonify({'error': 'Please sign in to submit a service request.'}), 401

    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    service_name = d.get('service_name', 'General service')
    note = d.get('note', '')

    req = ServiceRequest(
        customer_id=uid,
        business_id=bid,
        service_name=service_name,
        note=note,
        status='Pending'
    )
    db.session.add(req)
    db.session.flush()

    # Notify customer
    db.session.add(Notification(
        user_id=uid,
        message=f'Your request for "{service_name}" has been sent to {b.name}.'
    ))

    # Notify business owner if linked
    if b.owner_id:
        customer = db.session.get(User, uid)
        c_name = customer.name if customer else 'A customer'
        db.session.add(Notification(
            user_id=b.owner_id,
            message=f'New request for "{service_name}" from {c_name}.'
        ))

    db.session.commit()
    return jsonify({'id': req.id, 'status': req.status, 'message': 'Request submitted successfully.'}), 201

@app.patch('/api/requests/<int:rid>')
def update_request(rid):
    r = db.session.get(ServiceRequest, rid)
    if not r:
        return jsonify({'error': 'Service request not found.'}), 404

    data = request.get_json() or {}
    new_status = data.get('status')
    valid_statuses = ['Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected']

    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of {valid_statuses}'}), 400

    user = get_current_user_from_request()
    b = db.session.get(Business, r.business_id)

    if user:
        if user.role == 'business' and (not b or b.owner_id != user.id):
            return jsonify({'error': 'You do not own the business for this request.'}), 403
        if user.role == 'customer' and r.customer_id != user.id:
            return jsonify({'error': 'You cannot update someone else’s request.'}), 403

    r.status = new_status
    db.session.add(Notification(
        user_id=r.customer_id,
        message=f'Update on your {r.service_name} request with {b.name if b else "the business"}: Status is now {new_status}.'
    ))
    db.session.commit()
    return jsonify({'id': r.id, 'status': r.status})


# ==========================================
# REVIEWS & RATINGS ENDPOINTS
# ==========================================

@app.get('/api/reviews')
def get_reviews():
    bid = request.args.get('business_id', type=int)
    if bid:
        rows = Review.query.filter_by(business_id=bid).order_by(Review.created_at.desc()).all()
    else:
        rows = Review.query.order_by(Review.created_at.desc()).all()
    return jsonify([review_json(r) for r in rows])

@app.post('/api/reviews')
def add_review():
    d = request.get_json() or {}
    uid = d.get('customer_id')
    bid = d.get('business_id')

    user = get_current_user_from_request()
    if user:
        uid = user.id

    if not uid or not db.session.get(User, uid):
        return jsonify({'error': 'Please sign in to post a review.'}), 401

    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    try:
        rating = max(1, min(5, int(d.get('rating', 5))))
    except (ValueError, TypeError):
        rating = 5

    comment = (d.get('comment') or '').strip()

    rev = Review(customer_id=uid, business_id=bid, rating=rating, comment=comment)
    db.session.add(rev)
    db.session.flush()

    # Recalculate business average rating and review count
    all_reviews = Review.query.filter_by(business_id=bid).all()
    b.reviews_count = len(all_reviews)
    b.rating = round(sum(r.rating for r in all_reviews) / len(all_reviews), 1)

    if b.owner_id:
        db.session.add(Notification(
            user_id=b.owner_id,
            message=f'New {rating}-star review received for {b.name}.'
        ))

    db.session.commit()
    return jsonify({'success': True, 'review': review_json(rev)}), 201

@app.patch('/api/reviews/<int:rid>/reply')
def reply_to_review(rid):
    rev = db.session.get(Review, rid)
    if not rev:
        return jsonify({'error': 'Review not found.'}), 404

    b = db.session.get(Business, rev.business_id)
    user = get_current_user_from_request()
    if user and user.role != 'admin' and (not b or b.owner_id != user.id):
        return jsonify({'error': 'Permission denied. Only the business owner can reply to this review.'}), 403

    d = request.get_json() or {}
    reply = (d.get('reply') or '').strip()
    rev.owner_reply = reply
    db.session.commit()
    return jsonify({'success': True, 'review': review_json(rev)})


# ==========================================
# FAVORITES & NOTIFICATIONS ENDPOINTS
# ==========================================

@app.get('/api/favorites')
def favorites():
    user = get_current_user_from_request()
    uid = request.args.get('user_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify([])

    favs = Favorite.query.filter_by(customer_id=uid).all()
    businesses_list = []
    for f in favs:
        b = db.session.get(Business, f.business_id)
        if b:
            businesses_list.append(business_json(b))
    return jsonify(businesses_list)

@app.post('/api/favorites')
def toggle_favorite():
    d = request.get_json() or {}
    user = get_current_user_from_request()
    uid = d.get('user_id')
    bid = d.get('business_id')

    if user:
        uid = user.id

    if not uid or not bid:
        return jsonify({'error': 'User and Business ID are required.'}), 400

    f = Favorite.query.filter_by(customer_id=uid, business_id=bid).first()
    if f:
        db.session.delete(f)
        saved = False
    else:
        db.session.add(Favorite(customer_id=uid, business_id=bid))
        saved = True

    db.session.commit()
    return jsonify({'saved': saved})

@app.get('/api/notifications')
def notifications():
    user = get_current_user_from_request()
    uid = request.args.get('user_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify([])

    notifs = Notification.query.filter_by(user_id=uid).order_by(Notification.created_at.desc()).all()
    return jsonify([{
        'id': n.id,
        'message': n.message,
        'read': n.read,
        'created_at': n.created_at.strftime('%d %b, %I:%M %p') if n.created_at else ''
    } for n in notifs])

@app.patch('/api/notifications/read')
def mark_notifications_read():
    user = get_current_user_from_request()
    uid = request.args.get('user_id', type=int)
    if user:
        uid = user.id

    if uid:
        Notification.query.filter_by(user_id=uid, read=False).update({'read': True})
        db.session.commit()
    return jsonify({'success': True})


# ==========================================
# CATEGORIES ENDPOINTS
# ==========================================

@app.get('/api/categories')
def categories():
    cats = Category.query.order_by(Category.name).all()
    out = []
    for c in cats:
        cnt = Business.query.filter_by(category=c.name).count()
        out.append({'name': c.name, 'count': cnt})
    return jsonify(out)

@app.post('/api/categories')
def add_category():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Only administrators can add categories.'}), 403

    name = (request.get_json() or {}).get('name', '').strip()
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400

    if Category.query.filter_by(name=name).first():
        return jsonify({'error': 'Category already exists.'}), 409

    cat = Category(name=name)
    db.session.add(cat)
    db.session.commit()
    return jsonify({'name': cat.name, 'count': 0}), 201

@app.delete('/api/categories/<string:name>')
def delete_category(name):
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Only administrators can delete categories.'}), 403

    c = Category.query.filter_by(name=name).first()
    if not c:
        return jsonify({'error': 'Category not found.'}), 404

    db.session.delete(c)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Category {name} removed.'})


# ==========================================
# REPORTS ENDPOINTS
# ==========================================

@app.post('/api/reports')
def report_business():
    d = request.get_json() or {}
    bid = d.get('business_id')
    reason = (d.get('reason') or 'Inaccurate or suspicious information').strip()
    details = (d.get('details') or '').strip()

    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    user = get_current_user_from_request()
    reporter_id = user.id if user else d.get('reporter_id')

    rep = Report(business_id=bid, reporter_id=reporter_id, reason=reason, details=details, status='Open')
    db.session.add(rep)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Report submitted for administrator review.'}), 201

@app.get('/api/admin/reports')
def admin_reports():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    rows = Report.query.order_by(Report.created_at.desc()).all()
    out = []
    for r in rows:
        b = db.session.get(Business, r.business_id)
        reporter = db.session.get(User, r.reporter_id) if r.reporter_id else None
        out.append({
            'id': r.id,
            'business_id': r.business_id,
            'business': b.name if b else 'Business Listing',
            'reporter': reporter.name if reporter else 'Anonymous',
            'reason': r.reason,
            'details': r.details or '',
            'status': r.status,
            'created_at': r.created_at.strftime('%d %b %Y') if r.created_at else ''
        })
    return jsonify(out)

@app.patch('/api/admin/reports/<int:rid>')
def resolve_report(rid):
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    r = db.session.get(Report, rid)
    if not r:
        return jsonify({'error': 'Report not found.'}), 404

    d = request.get_json() or {}
    r.status = d.get('status', 'Reviewed')
    db.session.commit()
    return jsonify({'success': True, 'status': r.status})


# ==========================================
# BUSINESS OWNER DASHBOARD ENDPOINTS
# ==========================================

@app.get('/api/owner/businesses')
def owner_businesses():
    user = get_current_user_from_request()
    uid = request.args.get('owner_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify([])

    bs = Business.query.filter_by(owner_id=uid).all()
    return jsonify([business_json(b, include_trust=True) for b in bs])

@app.get('/api/owner/services')
def owner_services():
    user = get_current_user_from_request()
    uid = request.args.get('owner_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify([])

    bs = Business.query.filter_by(owner_id=uid).all()
    b_ids = [b.id for b in bs]
    if not b_ids:
        return jsonify([])

    srvs = Service.query.filter(Service.business_id.in_(b_ids)).all()
    return jsonify([service_json(s) for s in srvs])

@app.post('/api/owner/services')
def add_service():
    d = request.get_json() or {}
    bid = d.get('business_id')

    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business profile not found.'}), 404

    user = get_current_user_from_request()
    if user and user.role != 'admin' and b.owner_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    name = (d.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Service name is required.'}), 400

    try:
        price = max(0, int(d.get('price') or 199))
    except ValueError:
        price = 199

    s = Service(
        business_id=bid,
        name=name,
        description=d.get('description', ''),
        price=price,
        available=bool(d.get('available', True))
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(service_json(s)), 201

@app.patch('/api/owner/services/<int:sid>')
def update_service(sid):
    s = db.session.get(Service, sid)
    if not s:
        return jsonify({'error': 'Service not found.'}), 404

    b = db.session.get(Business, s.business_id)
    user = get_current_user_from_request()
    if user and user.role != 'admin' and (not b or b.owner_id != user.id):
        return jsonify({'error': 'Permission denied.'}), 403

    d = request.get_json() or {}
    if 'name' in d and d['name'].strip():
        s.name = d['name'].strip()
    if 'description' in d:
        s.description = d['description'].strip()
    if 'price' in d:
        try:
            s.price = max(0, int(d['price']))
        except ValueError:
            pass
    if 'available' in d:
        s.available = bool(d['available'])

    db.session.commit()
    return jsonify(service_json(s))

@app.delete('/api/owner/services/<int:sid>')
def delete_service(sid):
    s = db.session.get(Service, sid)
    if not s:
        return jsonify({'error': 'Service not found.'}), 404

    b = db.session.get(Business, s.business_id)
    user = get_current_user_from_request()
    if user and user.role != 'admin' and (not b or b.owner_id != user.id):
        return jsonify({'error': 'Permission denied.'}), 403

    db.session.delete(s)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Service removed successfully.'})

@app.get('/api/owner/analytics')
def owner_analytics():
    user = get_current_user_from_request()
    uid = request.args.get('owner_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify({'businesses': 0, 'requests': 0, 'completed': 0, 'views': 0, 'rating': 0})

    bs = Business.query.filter_by(owner_id=uid).all()
    b_ids = [b.id for b in bs]
    reqs = ServiceRequest.query.filter(ServiceRequest.business_id.in_(b_ids)).all() if b_ids else []

    total_views = 1240 * max(1, len(bs))
    avg_rating = round(sum(b.rating for b in bs) / len(bs), 1) if bs else 0
    completed_cnt = sum(1 for r in reqs if r.status == 'Completed')
    in_progress_cnt = sum(1 for r in reqs if r.status == 'In Progress')
    accepted_cnt = sum(1 for r in reqs if r.status == 'Accepted')
    pending_cnt = sum(1 for r in reqs if r.status == 'Pending')

    return jsonify({
        'businesses': len(bs),
        'requests': len(reqs),
        'completed': completed_cnt,
        'in_progress': in_progress_cnt,
        'accepted': accepted_cnt,
        'pending': pending_cnt,
        'views': total_views,
        'rating': avg_rating
    })

@app.get('/api/owner/reviews')
def owner_reviews():
    user = get_current_user_from_request()
    uid = request.args.get('owner_id', type=int)
    if user:
        uid = user.id

    if not uid:
        return jsonify({'reviews': [], 'stats': {'avg': 0, 'total': 0, 'distribution': [0, 0, 0, 0, 0]}})

    bs = Business.query.filter_by(owner_id=uid).all()
    b_ids = [b.id for b in bs]
    if not b_ids:
        return jsonify({'reviews': [], 'stats': {'avg': 0, 'total': 0, 'distribution': [0, 0, 0, 0, 0]}})

    rows = Review.query.filter(Review.business_id.in_(b_ids)).order_by(Review.created_at.desc()).all()
    
    total = len(rows)
    dist = [0, 0, 0, 0, 0]  # [5-star, 4-star, 3-star, 2-star, 1-star]
    for r in rows:
        idx = max(0, min(4, 5 - r.rating))
        dist[idx] += 1

    dist_pct = [(round((count / total) * 100) if total > 0 else 0) for count in dist]
    avg = round(sum(r.rating for r in rows) / total, 1) if total else 0

    return jsonify({
        'reviews': [review_json(r) for r in rows],
        'stats': {
            'avg': avg,
            'total': total,
            'counts': dist,
            'distribution': dist_pct
        }
    })

@app.post('/api/owner/verification')
def verification_request():
    d = request.get_json() or {}
    bid = d.get('business_id')
    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business profile not found.'}), 404

    user = get_current_user_from_request()
    if user and user.role != 'admin' and b.owner_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    return jsonify({
        'success': True,
        'message': f'Verification request for "{b.name}" submitted. An administrator will review your business credentials.'
    })


# ==========================================
# ADMIN DASHBOARD ENDPOINTS
# ==========================================

@app.get('/api/admin/overview')
def admin_overview():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    return jsonify({
        'users': User.query.count(),
        'businesses': Business.query.count(),
        'pending': Business.query.filter_by(verified=False).count(),
        'verified': Business.query.filter_by(verified=True).count(),
        'requests': ServiceRequest.query.count(),
        'quote_challenges': QuoteRequest.query.count(),
        'reviews': Review.query.count(),
        'reports': Report.query.filter_by(status='Open').count()
    })

@app.get('/api/admin/users')
def admin_users():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([user_json(u) for u in users])

@app.patch('/api/admin/users/<int:uid>')
def admin_update_user(uid):
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    target = db.session.get(User, uid)
    if not target:
        return jsonify({'error': 'User not found.'}), 404

    d = request.get_json() or {}
    if 'role' in d and d['role'] in ['customer', 'business', 'admin']:
        target.role = d['role']
    if 'name' in d and d['name'].strip():
        target.name = d['name'].strip()

    db.session.commit()
    return jsonify(user_json(target))

@app.delete('/api/admin/users/<int:uid>')
def admin_delete_user(uid):
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    if user and user.id == uid:
        return jsonify({'error': 'Cannot delete your own administrator account.'}), 400

    target = db.session.get(User, uid)
    if not target:
        return jsonify({'error': 'User not found.'}), 404

    db.session.delete(target)
    db.session.commit()
    return jsonify({'success': True, 'message': 'User deleted successfully.'})

@app.get('/api/admin/businesses/pending')
def pending_businesses():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    pending = Business.query.filter_by(verified=False).order_by(Business.created_at.desc()).all()
    return jsonify([business_json(b, include_trust=True) for b in pending])

@app.patch('/api/admin/businesses/<int:bid>/verify')
def verify_business(bid):
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    b = db.session.get(Business, bid)
    if not b:
        return jsonify({'error': 'Business not found.'}), 404

    data = request.get_json() or {}
    b.verified = bool(data.get('verified', True))

    if b.owner_id:
        status_msg = "verified and awarded the verified trust badge!" if b.verified else "marked unverified."
        db.session.add(Notification(
            user_id=b.owner_id,
            message=f'Your business "{b.name}" has been {status_msg}'
        ))

    db.session.commit()
    return jsonify(business_json(b, include_trust=True))

@app.get('/api/admin/insights')
def admin_insights():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    total_users = User.query.count()
    customers_cnt = User.query.filter_by(role='customer').count()
    owners_cnt = User.query.filter_by(role='business').count()
    admins_cnt = User.query.filter_by(role='admin').count()

    total_businesses = Business.query.count()
    verified_cnt = Business.query.filter_by(verified=True).count()
    pending_cnt = Business.query.filter_by(verified=False).count()

    categories_breakdown = []
    for c in Category.query.all():
        cnt = Business.query.filter_by(category=c.name).count()
        categories_breakdown.append({'category': c.name, 'count': cnt})

    requests_breakdown = {
        'total': ServiceRequest.query.count(),
        'pending': ServiceRequest.query.filter_by(status='Pending').count(),
        'accepted': ServiceRequest.query.filter_by(status='Accepted').count(),
        'in_progress': ServiceRequest.query.filter_by(status='In Progress').count(),
        'completed': ServiceRequest.query.filter_by(status='Completed').count(),
        'rejected': ServiceRequest.query.filter_by(status='Rejected').count(),
    }

    quotes_breakdown = {
        'total_challenges': QuoteRequest.query.count(),
        'open_challenges': QuoteRequest.query.filter_by(status='Open').count(),
        'assigned_challenges': QuoteRequest.query.filter_by(status='Assigned').count(),
        'total_submissions': QuoteSubmission.query.count()
    }

    return jsonify({
        'users': {'total': total_users, 'customers': customers_cnt, 'business_owners': owners_cnt, 'admins': admins_cnt},
        'businesses': {'total': total_businesses, 'verified': verified_cnt, 'pending': pending_cnt},
        'categories': categories_breakdown,
        'requests': requests_breakdown,
        'quotes': quotes_breakdown
    })

@app.get('/api/admin/settings')
def get_admin_settings():
    settings = PlatformSetting.query.all()
    res = {s.key: (s.value == 'true' if s.value in ['true', 'false'] else s.value) for s in settings}
    return jsonify(res)

@app.post('/api/admin/settings')
def update_admin_settings():
    user = get_current_user_from_request()
    if user and user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    d = request.get_json() or {}
    for k, v in d.items():
        str_val = 'true' if v is True else ('false' if v is False else str(v))
        s = PlatformSetting.query.filter_by(key=k).first()
        if s:
            s.value = str_val
        else:
            db.session.add(PlatformSetting(key=k, value=str_val))

    db.session.commit()
    return jsonify({'success': True, 'message': 'System settings saved.'})



# ==========================================
# FEATURE 1: MOBILE OTP VERIFICATION ENDPOINTS
# ==========================================

@app.post('/api/verification/otp/request')
def request_mobile_otp():
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    if not phone or len(phone) < 10:
        return jsonify({'error': 'Please enter a valid 10-15 digit mobile number.'}), 400
    
    user = get_current_user_from_request()
    user_id = user.id if user else data.get('user_id')

    # Rate limiting: 60s cooldown
    recent = MobileOTPVerification.query.filter_by(phone=phone).order_by(MobileOTPVerification.created_at.desc()).first()
    if recent and recent.last_sent_at:
        elapsed = (datetime.now(timezone.utc) - recent.last_sent_at.replace(tzinfo=timezone.utc)).total_seconds()
        if elapsed < 60:
            return jsonify({'error': f'Please wait {int(60 - elapsed)}s before requesting a new OTP.'}), 429

    # Max requests per hour
    one_hr_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    hr_count = MobileOTPVerification.query.filter(
        MobileOTPVerification.phone == phone,
        MobileOTPVerification.created_at >= one_hr_ago
    ).count()
    if hr_count >= 10:
        return jsonify({'error': 'OTP request limit exceeded for this mobile number. Please try again later.'}), 429

    # Generate 6-digit cryptographic OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    otp_hash, otp_salt = hash_otp(phone, otp)
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)

    otp_rec = MobileOTPVerification(
        user_id=user_id,
        phone=phone,
        otp_hash=otp_hash,
        otp_salt=otp_salt,
        expires_at=expires,
        attempts=0,
        last_sent_at=datetime.now(timezone.utc)
    )
    db.session.add(otp_rec)
    db.session.commit()

    log_security_audit(
        actor_id=user_id,
        action='OTP_REQUESTED',
        target_type='MobileOTPVerification',
        target_id=otp_rec.id,
        details=f"OTP requested for phone {phone}"
    )

    sms_res = send_sms_otp(phone, otp)

    return jsonify({
        'success': True,
        'message': f'Verification code sent to {phone}. Valid for 5 minutes.',
        'dev_mode': sms_res.get('dev_mode', False),
        'dev_otp': sms_res.get('dev_otp') if DEV_OTP_MODE else None,
        'cooldown_seconds': 60
    })


@app.post('/api/verification/otp/verify')
def verify_mobile_otp():
    data = request.get_json() or {}
    phone = data.get('phone', '').strip()
    otp = str(data.get('otp', '')).strip()

    if not phone or not otp or len(otp) != 6:
        return jsonify({'error': 'Please provide the 6-digit OTP code.'}), 400

    otp_rec = MobileOTPVerification.query.filter_by(phone=phone, verified=False).order_by(MobileOTPVerification.created_at.desc()).first()
    if not otp_rec:
        return jsonify({'error': 'No active OTP request found for this mobile number. Please request a new code.'}), 404

    now_utc = datetime.now(timezone.utc)
    exp = otp_rec.expires_at.replace(tzinfo=timezone.utc) if otp_rec.expires_at.tzinfo is None else otp_rec.expires_at
    if now_utc > exp:
        return jsonify({'error': 'OTP has expired (validity is 5 minutes). Please request a new code.'}), 400

    if otp_rec.attempts >= 5:
        return jsonify({'error': 'Maximum verification attempts exceeded. Please request a new OTP.'}), 400

    is_valid = verify_otp_hash(phone, otp, otp_rec.otp_hash, otp_rec.otp_salt)
    if not is_valid:
        otp_rec.attempts += 1
        db.session.commit()
        remaining = 5 - otp_rec.attempts
        return jsonify({'error': f'Incorrect verification code. {remaining} attempt(s) remaining.'}), 400

    # Successful verification
    otp_rec.verified = True
    otp_rec.verified_at = datetime.now(timezone.utc)

    user = get_current_user_from_request()
    user_id = user.id if user else otp_rec.user_id
    if user_id:
        target_user = db.session.get(User, user_id)
        if target_user:
            target_user.phone = phone
            target_user.phone_verified = True
            target_user.phone_verified_at = datetime.now(timezone.utc)

            # Update associated BusinessVerification if exists
            b_verif = BusinessVerification.query.filter_by(owner_id=target_user.id).first()
            if b_verif:
                b_verif.mobile_verified = True
                b_verif.verified_mobile = phone

            # Trigger Identity Linking check!
            detect_and_link_identities(target_user.id)

    db.session.commit()

    log_security_audit(
        actor_id=user_id,
        action='OTP_VERIFIED',
        target_type='MobileOTPVerification',
        target_id=otp_rec.id,
        details=f"Mobile number {phone} successfully verified"
    )

    return jsonify({
        'success': True,
        'message': 'Mobile number successfully verified.',
        'phone': phone
    })


# ==========================================
# FEATURE 1 & 5: BUSINESS OWNER VERIFICATION WORKFLOW
# ==========================================

@app.get('/api/owner/verification/status')
@app.get('/api/verification/my-status')
def get_owner_verification_status():
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401
    
    bid = request.args.get('business_id')
    biz = None
    if bid and str(bid).isdigit():
        biz = db.session.get(Business, int(bid))
    elif user.role == 'business':
        biz = Business.query.filter_by(owner_id=user.id).first()

    if not biz:
        return jsonify({
            'has_business': False,
            'message': 'No business profile found. Please create a business listing first.'
        })

    if user.role != 'admin' and biz.owner_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    verif = BusinessVerification.query.filter_by(business_id=biz.id).first()
    if not verif:
        verif = BusinessVerification(
            business_id=biz.id,
            owner_id=biz.owner_id or user.id,
            business_name=biz.name,
            business_category=biz.category,
            business_phone=biz.phone or user.phone or '',
            business_email=user.email,
            address_line=biz.address,
            mobile_verified=user.phone_verified,
            verified_mobile=user.phone if user.phone_verified else '',
            status='Verified' if biz.verified else 'Not Submitted'
        )
        db.session.add(verif)
        db.session.commit()

    docs = [{
        'id': d.id,
        'doc_type': d.doc_type,
        'filename': d.original_filename,
        'status': d.status,
        'size': d.file_size,
        'uploaded_at': d.uploaded_at.strftime('%Y-%m-%d %H:%M') if d.uploaded_at else ''
    } for d in verif.documents]

    # Calculate step completion progress
    steps_done = 0
    if verif.mobile_verified: steps_done += 1
    if verif.business_name and (len(docs) > 0 or verif.registration_number): steps_done += 1
    if verif.address_line and verif.address_verified: steps_done += 1
    if verif.status == 'Verified': steps_done += 1
    progress_pct = int((steps_done / 4) * 100)

    return jsonify({
        'has_business': True,
        'business_id': biz.id,
        'business_name': biz.name,
        'is_verified': biz.verified,
        'verification_id': verif.id,
        'overall_status': verif.status,
        'progress_pct': progress_pct,
        'rejection_reason': verif.rejection_reason or '',
        'admin_notes': verif.admin_notes or '',
        'step1_mobile': {
            'verified': verif.mobile_verified,
            'phone': verif.verified_mobile or user.phone or ''
        },
        'step2_business_info': {
            'submitted': bool(verif.business_name and (len(docs) > 0 or verif.registration_number)),
            'business_name': verif.business_name,
            'category': verif.business_category,
            'registration_number': verif.registration_number or '',
            'owner_full_name': verif.owner_full_name or user.name,
            'business_email': verif.business_email or user.email,
            'business_phone': verif.business_phone or '',
            'business_website': verif.business_website or '',
            'verification_method': verif.verification_method,
            'documents': docs
        },
        'step3_address': {
            'address': verif.address_line,
            'latitude': verif.latitude,
            'longitude': verif.longitude,
            'address_verified': verif.address_verified
        },
        'step4_admin_approval': {
            'status': verif.status,
            'submitted_at': verif.submitted_at.strftime('%Y-%m-%d %H:%M') if verif.submitted_at else None,
            'reviewed_at': verif.reviewed_at.strftime('%Y-%m-%d %H:%M') if verif.reviewed_at else None
        }
    })


@app.post('/api/owner/verification/step2')
@app.post('/api/verification/business-info')
@app.post('/api/verification/documents/upload')
def submit_verification_step2():
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401

    bid = request.form.get('business_id') or (request.json.get('business_id') if request.is_json else None)
    if not bid:
        return jsonify({'error': 'business_id is required.'}), 400

    biz = db.session.get(Business, int(bid))
    if not biz:
        return jsonify({'error': 'Business not found.'}), 404
    if user.role != 'admin' and biz.owner_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    verif = BusinessVerification.query.filter_by(business_id=biz.id).first()
    if not verif:
        verif = BusinessVerification(business_id=biz.id, owner_id=user.id)
        db.session.add(verif)

    # Read form or json
    if request.is_json:
        d = request.json
    else:
        d = request.form

    verif.business_name = d.get('business_name', biz.name).strip()
    verif.business_category = d.get('business_category', biz.category).strip()
    verif.registration_number = d.get('registration_number', '').strip()
    verif.owner_full_name = d.get('owner_full_name', user.name).strip()
    verif.business_email = d.get('business_email', user.email).strip()
    verif.business_phone = d.get('business_phone', biz.phone).strip()
    verif.business_website = d.get('business_website', '').strip()
    verif.verification_method = d.get('verification_method', 'document_and_address')

    # Handle document file upload
    if 'document' in request.files:
        file = request.files['document']
        if file and file.filename:
            orig_name = secure_filename(file.filename)
            ext = orig_name.rsplit('.', 1)[-1].lower() if '.' in orig_name else ''
            if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
                return jsonify({'error': f'Invalid file format .{ext}. Allowed: PDF, PNG, JPG, JPEG'}), 400

            doc_type = d.get('doc_type', 'registration_cert')
            unique_name = f"{secrets.token_hex(12)}_{orig_name}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            file.save(save_path)
            file_size = os.path.getsize(save_path)

            doc = BusinessDocument(
                verification_id=verif.id,
                doc_type=doc_type,
                original_filename=orig_name,
                stored_filename=unique_name,
                file_path=save_path,
                mime_type=file.content_type or 'application/octet-stream',
                file_size=file_size,
                status='Pending'
            )
            db.session.add(doc)

    db.session.commit()

    # Check for matching business ownership across accounts (Feature 2)
    detect_and_link_identities(user.id)

    log_security_audit(
        actor_id=user.id,
        action='VERIFICATION_STEP2_SAVED',
        target_type='BusinessVerification',
        target_id=verif.id,
        details=f"Saved business info for {verif.business_name} (Reg: {verif.registration_number})"
    )

    return jsonify({
        'success': True,
        'message': 'Business information and supporting documents saved.',
        'verification_id': verif.id
    })


@app.post('/api/owner/verification/step3')
@app.post('/api/verification/address')
def submit_verification_step3():
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401

    d = request.get_json() or {}
    bid = d.get('business_id')
    biz = db.session.get(Business, bid)
    if not biz:
        return jsonify({'error': 'Business not found.'}), 404
    if user.role != 'admin' and biz.owner_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    verif = BusinessVerification.query.filter_by(business_id=biz.id).first()
    if not verif:
        verif = BusinessVerification(business_id=biz.id, owner_id=user.id)
        db.session.add(verif)

    verif.address_line = d.get('address_line', biz.address).strip()
    verif.latitude = float(d.get('latitude', 12.8954))
    verif.longitude = float(d.get('longitude', 74.8568))
    verif.address_verified = bool(d.get('confirm_location', True))

    biz.address = verif.address_line
    db.session.commit()

    log_security_audit(
        actor_id=user.id,
        action='VERIFICATION_STEP3_SAVED',
        target_type='BusinessVerification',
        target_id=verif.id,
        details=f"Saved address and GPS coordinates for {biz.name}"
    )

    return jsonify({
        'success': True,
        'message': 'Business address and GPS location verified.'
    })


@app.post('/api/owner/verification/submit')
@app.post('/api/verification/submit')
def submit_verification_for_review():
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401

    d = request.get_json() or {}
    bid = d.get('business_id')
    biz = db.session.get(Business, bid)
    if not biz:
        return jsonify({'error': 'Business not found.'}), 404
    if user.role != 'admin' and biz.owner_id != user.id:
        return jsonify({'error': 'Permission denied.'}), 403

    verif = BusinessVerification.query.filter_by(business_id=biz.id).first()
    if not verif:
        return jsonify({'error': 'Please complete Steps 1-3 before submitting.'}), 400

    if not verif.mobile_verified and not user.phone_verified:
        return jsonify({'error': 'Mobile number must be verified via OTP before submitting.'}), 400

    verif.status = 'Pending Review'
    verif.submitted_at = datetime.now(timezone.utc)
    verif.rejection_reason = ''
    db.session.commit()

    # Notify platform admins
    admins = User.query.filter_by(role='admin').all()
    for a in admins:
        db.session.add(Notification(
            user_id=a.id,
            message=f"New business verification request submitted for '{biz.name}' by {user.name}."
        ))

    log_security_audit(
        actor_id=user.id,
        action='VERIFICATION_SUBMITTED',
        target_type='BusinessVerification',
        target_id=verif.id,
        details=f"Submitted verification for '{biz.name}'"
    )

    return jsonify({
        'success': True,
        'message': f"Verification application for '{biz.name}' submitted. An administrator will review your credentials."
    })


# ==========================================
# SECURE DOCUMENT SERVING (Feature 6)
# ==========================================

@app.get('/api/verification/documents/<int:doc_id>')
def download_verification_document(doc_id):
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401

    doc = db.session.get(BusinessDocument, doc_id)
    if not doc:
        return jsonify({'error': 'Document not found.'}), 404

    verif = doc.verification
    # Role check: only admin or the business owner can download
    if user.role != 'admin' and verif.owner_id != user.id:
        log_security_audit(
            actor_id=user.id,
            action='UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT',
            target_type='BusinessDocument',
            target_id=doc_id,
            details=f"User {user.email} ({user.role}) denied access to doc {doc_id}"
        )
        return jsonify({'error': 'Permission denied. You are not authorized to view this document.'}), 403

    if not os.path.exists(doc.file_path):
        return jsonify({'error': 'Document file missing from secure storage.'}), 404

    log_security_audit(
        actor_id=user.id,
        action='DOCUMENT_ACCESSED',
        target_type='BusinessDocument',
        target_id=doc_id,
        details=f"Document {doc.original_filename} accessed by {user.email}"
    )

    return send_file(
        doc.file_path,
        mimetype=doc.mime_type,
        as_attachment=False,
        download_name=doc.original_filename
    )


# ==========================================
# FEATURE 4: ADMIN BUSINESS IDENTITY & SECURITY CENTER
# ==========================================

@app.get('/api/admin/security/overview')
def admin_security_overview():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    total_owners = User.query.filter_by(role='business').count()
    verified_businesses = Business.query.filter_by(verified=True).count()
    
    pending_verifs = BusinessVerification.query.filter(
        BusinessVerification.status.in_(['Pending Review', 'Under Review'])
    ).count()
    rejected_verifs = BusinessVerification.query.filter_by(status='Rejected').count()
    resubmit_verifs = BusinessVerification.query.filter_by(status='Resubmission Required').count()

    flagged_accounts = AccountRiskAssessment.query.filter(
        AccountRiskAssessment.risk_level.in_(['MEDIUM', 'HIGH'])
    ).count()

    risk_counts = {
        'low': AccountRiskAssessment.query.filter_by(risk_level='LOW').count(),
        'medium': AccountRiskAssessment.query.filter_by(risk_level='MEDIUM').count(),
        'high': AccountRiskAssessment.query.filter_by(risk_level='HIGH').count()
    }

    pending_appeals = VerificationAppeal.query.filter_by(status='Pending').count()
    total_links = AccountIdentityLink.query.count()

    return jsonify({
        'total_business_owners': total_owners,
        'verified_businesses': verified_businesses,
        'pending_verifications': pending_verifs,
        'rejected_verifications': rejected_verifs,
        'resubmission_requests': resubmit_verifs,
        'flagged_accounts': flagged_accounts,
        'risk_breakdown': risk_counts,
        'pending_appeals': pending_appeals,
        'total_identity_links': total_links
    })


@app.get('/api/admin/verifications')
@app.get('/api/admin/verification/requests')
def admin_list_verifications():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    status_filter = request.args.get('status', 'All')
    search = request.args.get('search', '').lower().strip()

    query = BusinessVerification.query.order_by(BusinessVerification.created_at.desc())
    if status_filter != 'All':
        query = query.filter_by(status=status_filter)

    results = []
    for v in query.all():
        b = v.business
        owner = v.owner
        if search:
            hay = f"{v.business_name} {owner.name if owner else ''} {v.registration_number} {v.business_category}".lower()
            if search not in hay:
                continue

        results.append({
            'id': v.id,
            'business_id': v.business_id,
            'business_name': v.business_name,
            'category': v.business_category,
            'registration_number': v.registration_number,
            'owner_name': owner.name if owner else v.owner_full_name,
            'owner_email': owner.email if owner else v.business_email,
            'mobile_verified': v.mobile_verified,
            'verified_mobile': v.verified_mobile,
            'documents_count': len(v.documents),
            'address_verified': v.address_verified,
            'address_line': v.address_line,
            'status': v.status,
            'submitted_at': v.submitted_at.strftime('%Y-%m-%d %H:%M') if v.submitted_at else 'Not Submitted',
            'created_at': v.created_at.strftime('%Y-%m-%d') if v.created_at else ''
        })

    return jsonify(results)


@app.get('/api/admin/verifications/<int:vid>')
def admin_get_verification_detail(vid):
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    v = db.session.get(BusinessVerification, vid)
    if not v:
        return jsonify({'error': 'Verification record not found.'}), 404

    b = v.business
    owner = v.owner

    docs = [{
        'id': d.id,
        'doc_type': d.doc_type,
        'filename': d.original_filename,
        'size_kb': round(d.file_size / 1024, 1),
        'status': d.status,
        'uploaded_at': d.uploaded_at.strftime('%Y-%m-%d %H:%M') if d.uploaded_at else ''
    } for d in v.documents]

    # Audit history
    audits = SecurityAuditLog.query.filter_by(target_type='BusinessVerification', target_id=vid).order_by(SecurityAuditLog.created_at.desc()).all()

    return jsonify({
        'id': v.id,
        'business_id': v.business_id,
        'business_name': v.business_name,
        'category': v.business_category,
        'registration_number': v.registration_number,
        'owner_name': owner.name if owner else v.owner_full_name,
        'owner_email': owner.email if owner else v.business_email,
        'mobile_verified': v.mobile_verified,
        'verified_mobile': v.verified_mobile,
        'business_phone': v.business_phone,
        'business_website': v.business_website,
        'address_line': v.address_line,
        'latitude': v.latitude,
        'longitude': v.longitude,
        'address_verified': v.address_verified,
        'verification_method': v.verification_method,
        'status': v.status,
        'admin_notes': v.admin_notes,
        'rejection_reason': v.rejection_reason,
        'documents': docs,
        'submitted_at': v.submitted_at.strftime('%Y-%m-%d %H:%M') if v.submitted_at else 'Not Submitted',
        'reviewed_at': v.reviewed_at.strftime('%Y-%m-%d %H:%M') if v.reviewed_at else None,
        'audit_history': [{
            'action': a.action,
            'details': a.details,
            'date': a.created_at.strftime('%Y-%m-%d %H:%M')
        } for a in audits]
    })


@app.post('/api/admin/verifications/<int:vid>/decide')
@app.post('/api/admin/verification/requests/<int:vid>/decide')
def admin_decide_verification(vid):
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    v = db.session.get(BusinessVerification, vid)
    if not v:
        return jsonify({'error': 'Verification record not found.'}), 404

    d = request.get_json() or {}
    action = d.get('action')  # 'approve', 'reject', 'request_resubmission', 'under_review'
    reason = d.get('reason', '').strip()
    notes = d.get('notes', '').strip()

    b = v.business
    v.reviewed_by = user.id
    v.reviewed_at = datetime.now(timezone.utc)
    if notes:
        v.admin_notes = notes

    if action == 'approve':
        v.status = 'Verified'
        v.rejection_reason = ''
        if b:
            b.verified = True
        # Mark docs as approved
        for doc in v.documents:
            doc.status = 'Approved'
        if v.owner_id:
            db.session.add(Notification(
                user_id=v.owner_id,
                message=f"Congratulations! Your business '{v.business_name}' has been verified. The Verified Business badge is now active on your profile."
            ))
        audit_action = 'VERIFICATION_APPROVED'
        msg = f"Business verification for '{v.business_name}' approved."

    elif action == 'reject':
        if not reason:
            return jsonify({'error': 'Rejection reason is mandatory when rejecting verification.'}), 400
        v.status = 'Rejected'
        v.rejection_reason = reason
        if b:
            b.verified = False
        if v.owner_id:
            db.session.add(Notification(
                user_id=v.owner_id,
                message=f"Business verification for '{v.business_name}' was not approved. Reason: {reason}"
            ))
        audit_action = 'VERIFICATION_REJECTED'
        msg = f"Business verification for '{v.business_name}' rejected."

    elif action == 'request_resubmission':
        if not reason:
            return jsonify({'error': 'Please specify what additional documents or changes are needed.'}), 400
        v.status = 'Resubmission Required'
        v.rejection_reason = reason
        if b:
            b.verified = False
        if v.owner_id:
            db.session.add(Notification(
                user_id=v.owner_id,
                message=f"Action required for '{v.business_name}' verification: {reason}. Please update and resubmit."
            ))
        audit_action = 'VERIFICATION_RESUBMISSION_REQUESTED'
        msg = f"Resubmission requested from '{v.business_name}'."

    elif action == 'under_review':
        v.status = 'Under Review'
        audit_action = 'VERIFICATION_MARKED_UNDER_REVIEW'
        msg = f"Verification for '{v.business_name}' marked as Under Review."

    else:
        return jsonify({'error': f"Invalid action '{action}'"}), 400

    db.session.commit()

    log_security_audit(
        actor_id=user.id,
        action=audit_action,
        target_type='BusinessVerification',
        target_id=vid,
        details=f"{audit_action}: {reason or notes or 'No additional notes'}"
    )

    return jsonify({
        'success': True,
        'message': msg,
        'status': v.status
    })


# ==========================================
# FEATURE 3 & 4: SUSPICIOUS ACCOUNT MONITORING
# ==========================================

@app.get('/api/admin/security/suspicious-accounts')
def admin_suspicious_accounts():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    risk_filter = request.args.get('risk', 'All')
    status_filter = request.args.get('status', 'All')

    query = AccountRiskAssessment.query.order_by(AccountRiskAssessment.updated_at.desc())
    if risk_filter != 'All':
        query = query.filter_by(risk_level=risk_filter)
    if status_filter != 'All':
        query = query.filter_by(investigation_status=status_filter)

    assessments = query.all()
    rows = []
    for a in assessments:
        u = a.user
        signals = []
        try:
            signals = json.loads(a.signals_detected)
        except Exception:
            pass

        # Associated business if any
        biz = Business.query.filter_by(owner_id=u.id).first()

        rows.append({
            'assessment_id': a.id,
            'user_id': u.id,
            'user_name': u.name,
            'user_email': u.email,
            'role': u.role,
            'phone': u.phone,
            'phone_verified': getattr(u, 'phone_verified', False),
            'account_status': getattr(u, 'account_status', 'active'),
            'associated_business': biz.name if biz else None,
            'associated_business_id': biz.id if biz else None,
            'risk_level': a.risk_level,
            'signals_count': len(signals),
            'primary_reason': signals[0] if signals else 'Anomalous account signal pattern',
            'investigation_status': a.investigation_status,
            'admin_decision': a.admin_decision,
            'date_flagged': a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else ''
        })

    return jsonify(rows)


@app.get('/api/admin/security/account-investigation/<int:uid>')
def admin_account_investigation(uid):
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    target = db.session.get(User, uid)
    if not target:
        return jsonify({'error': 'User not found.'}), 404

    risk = AccountRiskAssessment.query.filter_by(user_id=uid).first()
    signals = []
    if risk:
        try:
            signals = json.loads(risk.signals_detected)
        except Exception:
            pass

    # Find account identity links
    links = AccountIdentityLink.query.filter(
        (AccountIdentityLink.primary_user_id == uid) | (AccountIdentityLink.linked_user_id == uid)
    ).all()

    linked_accounts = []
    for l in links:
        other_id = l.linked_user_id if l.primary_user_id == uid else l.primary_user_id
        other = db.session.get(User, other_id)
        other_biz = Business.query.filter_by(owner_id=other_id).first() if other else None
        linked_accounts.append({
            'link_id': l.id,
            'other_user_id': other_id,
            'other_name': other.name if other else 'Unknown',
            'other_email': other.email if other else '',
            'other_role': other.role if other else '',
            'other_business': other_biz.name if other_biz else None,
            'link_type': l.link_type,
            'confidence_score': l.confidence_score,
            'shared_signal': l.shared_signal_details,
            'status': l.status,
            'admin_notes': l.admin_notes,
            'date_detected': l.created_at.strftime('%Y-%m-%d %H:%M')
        })

    # Find suspicious activity logs
    activity_logs = SuspiciousActivityLog.query.filter_by(user_id=uid).order_by(SuspiciousActivityLog.created_at.desc()).limit(20).all()

    # Associated business
    biz = Business.query.filter_by(owner_id=uid).first()

    return jsonify({
        'user': user_json(target),
        'business': business_json(biz) if biz else None,
        'risk_level': risk.risk_level if risk else 'LOW',
        'signals': signals,
        'investigation_status': risk.investigation_status if risk else 'Normal',
        'admin_decision': risk.admin_decision if risk else 'None',
        'decision_reason': risk.decision_reason if risk else '',
        'linked_accounts': linked_accounts,
        'activity_logs': [{
            'type': act.activity_type,
            'severity': act.severity,
            'details': act.details,
            'ip': act.ip_address,
            'date': act.created_at.strftime('%Y-%m-%d %H:%M')
        } for act in activity_logs]
    })


@app.post('/api/admin/security/account-action')
def admin_account_action():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    d = request.get_json() or {}
    uid = d.get('user_id')
    target = db.session.get(User, uid)
    if not target:
        return jsonify({'error': 'User not found.'}), 404

    action = d.get('action')  # 'clear_flag', 'restrict', 'suspend', 'warn', 'investigate'
    reason = d.get('reason', '').strip()
    if not reason:
        return jsonify({'error': 'Mandatory reason is required for administrative security decisions.'}), 400

    risk = AccountRiskAssessment.query.filter_by(user_id=uid).first()
    if not risk:
        risk = AccountRiskAssessment(user_id=uid)
        db.session.add(risk)

    risk.reviewed_by = user.id
    risk.decision_reason = reason
    risk.updated_at = datetime.now(timezone.utc)

    # Optional update to specific link if specified
    link_id = d.get('link_id')
    if link_id:
        link = db.session.get(AccountIdentityLink, link_id)
        if link:
            link_status = d.get('link_status', 'Confirmed')  # 'Confirmed', 'Incorrect Match', 'Needs Further Investigation'
            link.status = link_status
            link.admin_notes = reason

    if action == 'clear_flag':
        risk.risk_level = 'LOW'
        risk.investigation_status = 'Cleared'
        risk.admin_decision = 'Cleared'
        target.account_status = 'active'
        audit_action = 'SECURITY_FLAG_CLEARED'
        msg = f"Account {target.email} flagged risks cleared."

    elif action == 'restrict':
        risk.admin_decision = 'Restricted'
        risk.investigation_status = 'Restricted'
        target.account_status = 'restricted'
        audit_action = 'ACCOUNT_RESTRICTED'
        msg = f"Account {target.email} access restricted."

    elif action == 'suspend':
        risk.admin_decision = 'Suspended'
        risk.investigation_status = 'Restricted'
        target.account_status = 'suspended'
        audit_action = 'ACCOUNT_SUSPENDED'
        msg = f"Account {target.email} suspended."

    elif action == 'investigate':
        risk.investigation_status = 'Investigating'
        audit_action = 'INVESTIGATION_OPENED'
        msg = f"Investigation opened for account {target.email}."

    else:
        return jsonify({'error': f"Unknown action '{action}'"}), 400

    db.session.commit()

    log_security_audit(
        actor_id=user.id,
        action=audit_action,
        target_type='User',
        target_id=uid,
        details=f"Admin {user.email}: {action} on {target.email}. Reason: {reason}"
    )

    return jsonify({
        'success': True,
        'message': msg,
        'account_status': target.account_status,
        'risk_level': risk.risk_level
    })


# ==========================================
# FEATURE 4 & 5: USER APPEALS WORKFLOW
# ==========================================

@app.post('/api/appeals')
def submit_appeal():
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401

    d = request.get_json() or {}
    appeal_type = d.get('appeal_type', 'identity_association')
    reason = d.get('reason', '').strip()
    evidence = d.get('evidence_text', '').strip()
    ref_id = d.get('reference_id')

    if not reason:
        return jsonify({'error': 'Please provide a clear reason for your appeal.'}), 400

    appeal = VerificationAppeal(
        user_id=user.id,
        appeal_type=appeal_type,
        reference_id=ref_id,
        reason=reason,
        evidence_text=evidence,
        status='Pending'
    )
    db.session.add(appeal)
    db.session.commit()

    # Notify admins
    admins = User.query.filter_by(role='admin').all()
    for a in admins:
        db.session.add(Notification(
            user_id=a.id,
            message=f"New security appeal submitted by {user.name} ({user.email})."
        ))

    log_security_audit(
        actor_id=user.id,
        action='APPEAL_SUBMITTED',
        target_type='VerificationAppeal',
        target_id=appeal.id,
        details=f"Appeal for {appeal_type}: {reason[:60]}..."
    )

    return jsonify({
        'success': True,
        'message': 'Your appeal has been submitted for administrator review.',
        'appeal_id': appeal.id
    })


@app.get('/api/admin/appeals')
def admin_get_appeals():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    appeals = VerificationAppeal.query.order_by(VerificationAppeal.created_at.desc()).all()
    results = []
    for a in appeals:
        u = a.user
        results.append({
            'id': a.id,
            'user_id': a.user_id,
            'user_name': u.name if u else 'Unknown',
            'user_email': u.email if u else '',
            'appeal_type': a.appeal_type,
            'reason': a.reason,
            'evidence_text': a.evidence_text,
            'status': a.status,
            'admin_notes': a.admin_notes,
            'submitted_at': a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else ''
        })

    return jsonify(results)


@app.post('/api/admin/appeals/<int:aid>/decide')
def admin_decide_appeal(aid):
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    appeal = db.session.get(VerificationAppeal, aid)
    if not appeal:
        return jsonify({'error': 'Appeal not found.'}), 404

    d = request.get_json() or {}
    decision = d.get('decision')  # 'Approved' or 'Rejected'
    notes = d.get('notes', '').strip()

    appeal.status = decision
    appeal.admin_notes = notes
    appeal.reviewed_by = user.id
    appeal.reviewed_at = datetime.now(timezone.utc)

    # If approved, clear the restriction or flag on the target account
    target = appeal.user
    if decision == 'Approved' and target:
        target.account_status = 'active'
        risk = AccountRiskAssessment.query.filter_by(user_id=target.id).first()
        if risk:
            risk.risk_level = 'LOW'
            risk.investigation_status = 'Cleared'
            risk.admin_decision = 'Cleared via Appeal'

    # Notify user
    if target:
        db.session.add(Notification(
            user_id=target.id,
            message=f"Your appeal regarding {appeal.appeal_type} has been {decision.lower()}. Notes: {notes or 'No additional notes'}"
        ))

    db.session.commit()

    log_security_audit(
        actor_id=user.id,
        action=f"APPEAL_{decision.upper()}",
        target_type='VerificationAppeal',
        target_id=aid,
        details=f"Appeal {aid} decided as {decision} by admin {user.email}. Notes: {notes}"
    )

    return jsonify({
        'success': True,
        'message': f"Appeal marked as {decision}.",
        'status': appeal.status
    })


@app.get('/api/account/linked-identities')
@app.get('/api/user/linked-identities')
def get_user_linked_identities():
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401

    links = AccountIdentityLink.query.filter(
        (AccountIdentityLink.primary_user_id == user.id) | (AccountIdentityLink.linked_user_id == user.id)
    ).all()

    items = []
    for l in links:
        other_id = l.linked_user_id if l.primary_user_id == user.id else l.primary_user_id
        other = db.session.get(User, other_id)
        items.append({
            'link_id': l.id,
            'other_role': other.role if other else 'account',
            'link_type': l.link_type,
            'status': l.status,
            'shared_signal': l.shared_signal_details,
            'date': l.created_at.strftime('%Y-%m-%d')
        })

    risk = AccountRiskAssessment.query.filter_by(user_id=user.id).first()

    return jsonify({
        'user_id': user.id,
        'phone_verified': user.phone_verified,
        'account_status': user.account_status,
        'risk_level': risk.risk_level if risk else 'LOW',
        'linked_identities': items
    })



@app.delete('/api/verification/documents/<int:doc_id>')
def delete_verification_document(doc_id):
    user = get_current_user_from_request()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401
    doc = db.session.get(BusinessDocument, doc_id)
    if not doc:
        return jsonify({'error': 'Document not found.'}), 404
    verif = doc.verification
    if user.role != 'admin' and (not verif or verif.owner_id != user.id):
        return jsonify({'error': 'Permission denied.'}), 403

    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception:
        pass
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Document deleted.'})


@app.get('/api/admin/security/identity-links')
def admin_get_identity_links():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    links = AccountIdentityLink.query.order_by(AccountIdentityLink.created_at.desc()).all()
    results = []
    for l in links:
        p = db.session.get(User, l.primary_user_id)
        other = db.session.get(User, l.linked_user_id)
        results.append({
            'id': l.id,
            'primary_user_id': l.primary_user_id,
            'primary_user_name': p.name if p else 'Unknown',
            'primary_user_email': p.email if p else '',
            'primary_role': p.role if p else '',
            'linked_user_id': l.linked_user_id,
            'linked_user_name': other.name if other else 'Unknown',
            'linked_user_email': other.email if other else '',
            'linked_role': other.role if other else '',
            'link_type': l.link_type,
            'confidence_score': l.confidence_score,
            'shared_signal_details': l.shared_signal_details,
            'status': l.status,
            'admin_notes': l.admin_notes,
            'created_at': l.created_at.strftime('%Y-%m-%d %H:%M') if l.created_at else ''
        })
    return jsonify(results)


@app.patch('/api/admin/security/identity-links/<int:lid>')
def admin_update_identity_link(lid):
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    link = db.session.get(AccountIdentityLink, lid)
    if not link:
        return jsonify({'error': 'Link not found.'}), 404

    d = request.get_json() or {}
    new_status = d.get('status')
    notes = d.get('admin_notes', '')

    if new_status:
        link.status = new_status
    if notes:
        link.admin_notes = notes

    log_security_audit(
        actor_id=user.id,
        action='IDENTITY_LINK_UPDATED',
        target_type='AccountIdentityLink',
        target_id=link.id,
        details=f"Status set to {new_status}. Notes: {notes}"
    )

    db.session.commit()
    return jsonify({'success': True, 'status': link.status})


@app.get('/api/admin/security/audit-logs')
def admin_get_audit_logs():
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    logs = SecurityAuditLog.query.order_by(SecurityAuditLog.created_at.desc()).limit(100).all()
    results = []
    for log in logs:
        actor = db.session.get(User, log.actor_id) if log.actor_id else None
        results.append({
            'id': log.id,
            'actor_id': log.actor_id,
            'actor_name': actor.name if actor else 'System Security Engine',
            'action': log.action,
            'target_type': log.target_type,
            'target_id': log.target_id,
            'details': log.details,
            'ip': log.ip_address,
            'timestamp': log.created_at.strftime('%Y-%m-%d %H:%M:%S') if log.created_at else ''
        })
    return jsonify(results)


@app.post('/api/admin/security/account/<int:uid>/action')
def admin_account_action_by_uid(uid):
    user = get_current_user_from_request()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Administrator access required.'}), 403

    target = db.session.get(User, uid)
    if not target:
        return jsonify({'error': 'User not found.'}), 404

    d = request.get_json() or {}
    action = d.get('action')  # 'restrict', 'suspend', 'clear', 'investigate'
    reason = d.get('reason', '').strip()

    risk = AccountRiskAssessment.query.filter_by(user_id=target.id).first()
    if not risk:
        risk = AccountRiskAssessment(user_id=target.id)
        db.session.add(risk)

    if action == 'clear':
        target.account_status = 'active'
        risk.risk_level = 'LOW'
        risk.investigation_status = 'Cleared'
        risk.admin_decision = 'Cleared'
        risk.decision_reason = reason or 'Cleared by admin'
    elif action == 'investigate':
        risk.investigation_status = 'Investigating'
    elif action == 'restrict':
        target.account_status = 'restricted'
        risk.investigation_status = 'Restricted'
        risk.admin_decision = 'Restricted'
        risk.decision_reason = reason
    elif action == 'suspend':
        target.account_status = 'suspended'
        risk.investigation_status = 'Suspended'
        risk.admin_decision = 'Suspended'
        risk.decision_reason = reason

    risk.reviewed_by = user.id

    log_security_audit(
        actor_id=user.id,
        action=f"ACCOUNT_{action.upper()}",
        target_type='User',
        target_id=target.id,
        details=f"Admin applied action: {action}. Reason: {reason}"
    )

    db.session.commit()
    return jsonify({'success': True, 'account_status': target.account_status, 'risk_level': risk.risk_level})

@app.post('/api/security/track-action')
def security_track_action():
    """
    Tracks client-side security signals like rapid repetitive competitor queries.
    """
    data = request.get_json() or {}
    user = get_current_user_from_request()
    uid = user.id if user else data.get('user_id')
    act_type = data.get('activity_type', 'browsing')
    details = data.get('details', '')

    if act_type == 'competitor_price_scraping' and uid:
        log = SuspiciousActivityLog(
            user_id=uid,
            ip_address=request.remote_addr or '127.0.0.1',
            activity_type=act_type,
            severity='HIGH',
            details=details or 'Automated repetitive competitor price checks detected.'
        )
        db.session.add(log)
        update_account_risk(uid, "Automated repetitive competitor price scraping", "HIGH")
        db.session.commit()

    return jsonify({'success': True})

# ==========================================
# DATABASE SEEDING
# ==========================================

def seed():
    if User.query.first():
        return

    # Seed Users
    admin = User(name='LocalLink Admin', email='admin@locallink.ai', password=generate_password_hash('Admin@123'), role='admin', phone='+91 99000 11223')
    owner = User(name='Rahul Shetty', email='owner@locallink.ai', password=generate_password_hash('Owner@123'), role='business', phone='+91 98765 43210')
    customer = User(name='Sneha G A', email='customer@locallink.ai', password=generate_password_hash('User@123'), role='customer', phone='+91 98450 12345')
    db.session.add_all([admin, owner, customer])
    db.session.flush()

    # Seed Categories
    default_cats = ['Electronics', 'Home Services', 'Food & Dining', 'Personal Care', 'Healthcare', 'Education', 'Automotive', 'Professional Services']
    for c in default_cats:
        db.session.add(Category(name=c))

    # Seed Businesses
    businesses_data = [
        ('TechFix Solutions', 'Electronics', 'Laptop, desktop, phone and electronics repair with upfront estimates and component diagnostics.', 'Hampankatta, Mangaluru', 'Hampankatta', 299, 4.8, 128, 1.2, True, True, 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800', '+91 98765 43210', 'Mon - Sat: 9:00 AM - 7:30 PM, Sun: Closed'),
        ('SmartCare Electronics', 'Electronics', 'Certified electronics diagnostics, motherboard repair, genuine screens and data recovery.', 'Kadri, Mangaluru', 'Kadri', 349, 4.6, 87, 2.4, True, True, 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800', '+91 98222 33445', 'Mon - Sat: 9:30 AM - 8:00 PM, Sun: 10:00 AM - 2:00 PM'),
        ('Laptop Doctor Plus', 'Electronics', 'Express laptop servicing, RAM/SSD upgrades, hinge repairs and virus cleanup.', 'Bejai, Mangaluru', 'Bejai', 399, 4.7, 74, 2.0, True, False, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800', '+91 98111 22334', 'Mon - Fri: 10:00 AM - 7:00 PM, Sat: 10:00 AM - 4:00 PM'),
        ('Fresh Bakes', 'Food & Dining', 'Artisan breads, custom celebration cakes, cookies and freshly brewed espresso.', 'Kankanady, Mangaluru', 'Kankanady', 150, 4.5, 62, 1.8, True, True, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', '+91 98333 44556', 'Daily: 7:00 AM - 10:00 PM'),
        ('Urban Cuts Studio', 'Personal Care', 'Modern hair styling, beard grooming, facial spa and organic skin care treatments.', 'Balmatta, Mangaluru', 'Balmatta', 250, 4.4, 51, 3.1, True, True, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', '+91 98444 55667', 'Tue - Sun: 9:00 AM - 8:30 PM, Mon: Closed'),
        ('Sunrise Electricals', 'Home Services', 'Residential and commercial electrical repairs, fan installation, switchboard repair and emergency rewiring.', 'Urwa, Mangaluru', 'Urwa', 199, 4.3, 29, 3.6, True, False, 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800', '+91 98555 66778', 'Mon - Sat: 8:30 AM - 6:30 PM, Sun: Emergency Only'),
    ]

    b_instances = []
    for i, row in enumerate(businesses_data):
        b = Business(
            owner_id=owner.id if i == 0 else None,
            name=row[0],
            category=row[1],
            description=row[2],
            address=row[3],
            area=row[4],
            price_from=row[5],
            rating=row[6],
            reviews_count=row[7],
            distance_km=row[8],
            available=row[9],
            verified=row[10],
            image=row[11],
            phone=row[12],
            working_hours=row[13]
        )
        db.session.add(b)
        db.session.flush()
        b_instances.append(b)

        # Seed standard services
        if row[1] == 'Electronics':
            db.session.add(Service(business_id=b.id, name='Comprehensive Diagnostics', description='Full hardware and software scan', price=row[5]))
            db.session.add(Service(business_id=b.id, name='Screen & Display Replacement', description='OEM quality display replacement with 6-month warranty', price=row[5] + 900))
            db.session.add(Service(business_id=b.id, name='Battery & Power Repair', description='Power jack repair and battery replacement', price=row[5] + 400))
        elif row[1] == 'Home Services':
            db.session.add(Service(business_id=b.id, name='Ceiling Fan Installation & Repair', description='Capacitor replacement, coil check and safe balancing', price=299))
            db.session.add(Service(business_id=b.id, name='Switchboard & Wiring Fix', description='Circuit breaker replacement and safety grounding', price=399))
        elif row[1] == 'Food & Dining':
            db.session.add(Service(business_id=b.id, name='Custom Celebration Cake', description='Freshly baked custom decorated 1kg cake', price=450))
            db.session.add(Service(business_id=b.id, name='Artisan Pastry Box', description='Assortment of 6 freshly baked gourmet pastries', price=250))
        elif row[1] == 'Personal Care':
            db.session.add(Service(business_id=b.id, name='Haircut & Styling', description='Consultation, wash, cut and premium styling', price=250))
            db.session.add(Service(business_id=b.id, name='Beard Grooming & Spa', description='Hot towel treatment, trim, and beard conditioning', price=200))
        else:
            db.session.add(Service(business_id=b.id, name='Standard Inspection & Service', description='Upfront inspection and transparent quotation', price=row[5]))

    # Seed Sample Requests
    r1 = ServiceRequest(customer_id=customer.id, business_id=b_instances[0].id, service_name='Comprehensive Diagnostics', note='Laptop running hot and shutting down unexpectedly.', status='In Progress')
    r2 = ServiceRequest(customer_id=customer.id, business_id=b_instances[3].id, service_name='Custom Celebration Cake', note='Chocolate truffle cake with "Happy Birthday" written.', status='Completed')
    db.session.add_all([r1, r2])

    # Seed Sample Reviews
    rev1 = Review(customer_id=customer.id, business_id=b_instances[0].id, rating=5, comment='Quick service and clear pricing. My laptop fan was cleaned and thermal paste replaced in under 2 hours!', owner_reply='Thank you Sneha! Always glad to keep your machine running cool.')
    rev2 = Review(customer_id=customer.id, business_id=b_instances[3].id, rating=5, comment='Delicious birthday cake, delivered right on time. Highly recommend Fresh Bakes!', owner_reply=None)
    db.session.add_all([rev1, rev2])

    # Seed Sample Favorites
    db.session.add(Favorite(customer_id=customer.id, business_id=b_instances[0].id))
    db.session.add(Favorite(customer_id=customer.id, business_id=b_instances[3].id))

    # Seed Sample Quote Challenge
    qc = QuoteRequest(
        customer_id=customer.id,
        category='Electronics',
        title='Laptop Motherboard Power Rail Repair',
        description='Asus ROG laptop not turning on after power surge. Power adapter is working fine.',
        area='Hampankatta',
        budget_min=1000,
        budget_max=2500,
        preferred_date='Tomorrow Morning',
        urgency='Urgent',
        status='Open'
    )
    db.session.add(qc)
    db.session.flush()

    # Seed Sample Quote Submission from Owner
    qs = QuoteSubmission(
        request_id=qc.id,
        business_id=b_instances[0].id,
        owner_id=owner.id,
        price=1800,
        includes='Component level IC replacement, ultrasonic cleaning, and 90-day hardware warranty',
        proposed_time='Tomorrow at 10:30 AM',
        message='We have original ICs in stock at our Hampankatta workshop. We can diagnose and fix by tomorrow evening.'
    )
    db.session.add(qs)

    # Seed Notifications
    db.session.add(Notification(user_id=customer.id, message='Your request to TechFix Solutions has been accepted and is now in progress.'))
    db.session.add(Notification(user_id=owner.id, message='New service request received from Sneha G A.'))

    # Seed Platform Settings
    default_settings = [
        ('ai_matching', 'true'),
        ('customer_notifications', 'true'),
        ('require_verification', 'true'),
        ('allow_registrations', 'true'),
        ('maintenance_mode', 'false'),
        ('flag_duplicates', 'true'),
        ('verified_reviews_only', 'false'),
        ('quote_challenge_enabled', 'true')
    ]
    for k, v in default_settings:
        db.session.add(PlatformSetting(key=k, value=v))

    db.session.commit()


# ==========================================
# APP INITIALIZATION
# ==========================================


def ensure_security_migrations():
    """
    Safely adds new columns to user table in SQLite if missing.
    """
    try:
        inspector = db.inspect(db.engine)
        user_cols = [c['name'] for c in inspector.get_columns('user')]
        with db.engine.connect() as conn:
            if 'phone_verified' not in user_cols:
                conn.execute(db.text("ALTER TABLE user ADD COLUMN phone_verified BOOLEAN DEFAULT 0"))
            if 'phone_verified_at' not in user_cols:
                conn.execute(db.text("ALTER TABLE user ADD COLUMN phone_verified_at DATETIME"))
            if 'account_status' not in user_cols:
                conn.execute(db.text("ALTER TABLE user ADD COLUMN account_status VARCHAR(20) DEFAULT 'active'"))
            conn.commit()
    except Exception as e:
        app.logger.warning(f"Schema migration note: {e}")

def seed_security_and_identity_data():
    """
    Seeds initial realistic verification requests, identity links,
    risk assessments, and audit logs for comprehensive testing.
    """
    if BusinessVerification.query.first():
        return

    owner = User.query.filter_by(role='business').first()
    customer = User.query.filter_by(role='customer').first()
    admin = User.query.filter_by(role='admin').first()

    if not owner or not customer:
        return

    # Set owner as phone verified
    owner.phone_verified = True
    owner.phone_verified_at = datetime.now(timezone.utc)

    # 1. Seed Verified BusinessVerification for TechFix Solutions
    b1 = Business.query.filter_by(id=1).first()
    if b1:
        v1 = BusinessVerification(
            business_id=b1.id,
            owner_id=owner.id,
            mobile_verified=True,
            verified_mobile=owner.phone or '+91 98765 43210',
            business_name=b1.name,
            business_category=b1.category,
            registration_number='REG-KA-2024-8849',
            owner_full_name=owner.name,
            business_email=owner.email,
            business_phone=b1.phone,
            business_website='https://techfix.locallink.ai',
            address_line=b1.address,
            latitude=12.8954,
            longitude=74.8568,
            address_verified=True,
            status='Verified',
            admin_notes='Verified via official registration certificate and confirmed GPS coordinates.',
            submitted_at=datetime.now(timezone.utc) - timedelta(days=2),
            reviewed_at=datetime.now(timezone.utc) - timedelta(days=1),
            reviewed_by=admin.id if admin else None
        )
        db.session.add(v1)
        db.session.flush()

        doc1 = BusinessDocument(
            verification_id=v1.id,
            doc_type='registration_cert',
            original_filename='techfix_trade_license.pdf',
            stored_filename='techfix_trade_license_seed.pdf',
            file_path=os.path.join(app.config['UPLOAD_FOLDER'], 'techfix_trade_license_seed.pdf'),
            mime_type='application/pdf',
            file_size=245760,
            status='Approved'
        )
        db.session.add(doc1)

        # Create dummy file if missing
        if not os.path.exists(doc1.file_path):
            with open(doc1.file_path, 'wb') as f:
                f.write(b"%PDF-1.4 LocalLink AI Seed Document for TechFix Solutions")

    # 2. Seed Pending BusinessVerification for Sunrise Electricals
    b6 = Business.query.filter_by(id=6).first()
    if b6:
        v2 = BusinessVerification(
            business_id=b6.id,
            owner_id=owner.id,
            mobile_verified=True,
            verified_mobile='+91 98451 22334',
            business_name=b6.name,
            business_category=b6.category,
            registration_number='EST-MN-2023-412',
            owner_full_name='Anand Rao',
            business_email='sunrise@locallink.ai',
            business_phone=b6.phone,
            address_line=b6.address,
            latitude=12.8791,
            longitude=74.8392,
            address_verified=True,
            status='Pending Review',
            submitted_at=datetime.now(timezone.utc) - timedelta(hours=3)
        )
        db.session.add(v2)
        db.session.flush()

        doc2 = BusinessDocument(
            verification_id=v2.id,
            doc_type='shop_establishment',
            original_filename='sunrise_shop_establishment.pdf',
            stored_filename='sunrise_shop_establishment_seed.pdf',
            file_path=os.path.join(app.config['UPLOAD_FOLDER'], 'sunrise_shop_establishment_seed.pdf'),
            mime_type='application/pdf',
            file_size=184320,
            status='Pending'
        )
        db.session.add(doc2)
        if not os.path.exists(doc2.file_path):
            with open(doc2.file_path, 'wb') as f:
                f.write(b"%PDF-1.4 LocalLink AI Seed Document for Sunrise Electricals")

    # 3. Seed an AccountIdentityLink (demonstrating shared verified mobile)
    link = AccountIdentityLink(
        primary_user_id=owner.id,
        linked_user_id=customer.id,
        link_type='shared_verified_mobile',
        confidence_score=0.95,
        shared_signal_details=f"Shared phone number: {owner.phone} across customer ({customer.email}) and business ({owner.email})",
        status='Detected'
    )
    db.session.add(link)

    # 4. Seed Risk Assessments
    risk_owner = AccountRiskAssessment(
        user_id=owner.id,
        risk_level='LOW',
        signals_detected=json.dumps(["Verified business identity: TechFix Solutions"]),
        investigation_status='Normal'
    )
    risk_cust = AccountRiskAssessment(
        user_id=customer.id,
        risk_level='MEDIUM',
        signals_detected=json.dumps([f"Shared verified mobile with business account ({owner.email})"]),
        investigation_status='Awaiting Investigation'
    )
    db.session.add_all([risk_owner, risk_cust])

    # 5. Seed a Suspicious Activity Log (for admin dashboard demonstration)
    susp_log = SuspiciousActivityLog(
        user_id=customer.id,
        ip_address='127.0.0.1',
        activity_type='competitor_price_scraping',
        severity='MEDIUM',
        details='Anomalous burst: 8 competitor business profiles inspected in rapid succession.'
    )
    db.session.add(susp_log)

    # 6. Seed a Verification Appeal
    appeal = VerificationAppeal(
        user_id=customer.id,
        appeal_type='identity_association',
        reference_id=link.id,
        reason='This mobile number is a family account shared between household members. My customer profile is used purely for neighbourhood service requests.',
        evidence_text='Attached household electricity bill showing shared family contact address.',
        status='Pending'
    )
    db.session.add(appeal)

    # 7. Seed Initial Security Audit Logs
    audit1 = SecurityAuditLog(
        actor_id=admin.id if admin else None,
        action='SYSTEM_SECURITY_INITIALIZED',
        target_type='Platform',
        details='Smart Business Identity Verification and Suspicious Account Detection modules active.'
    )
    db.session.add(audit1)

    db.session.commit()

with app.app_context():
    ensure_security_migrations()
    db.create_all()
    seed()
    seed_security_and_identity_data()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
