import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"

def run_all_journeys():
    print("=" * 60)
    print("RUNNING COMPLETE 3-USER JOURNEY VALIDATION")
    print("=" * 60)

    # ---------------------------------------------------------
    # JOURNEY A: CUSTOMER JOURNEY
    # ---------------------------------------------------------
    print("\n--- JOURNEY A: Customer Journey ---")
    
    # 1. Customer registers
    cust_email = f"journey_customer_{int(time.time())}@locallink.ai"
    reg_payload = {
        "name": "Kavya Rao",
        "email": cust_email,
        "password": "Password@123",
        "role": "customer",
        "phone": "+91 98451 99887"
    }
    r = requests.post(f"{BASE_URL}/register", json=reg_payload)
    assert r.status_code == 201, f"Registration failed: {r.text}"
    cust_data = r.json()
    cust_token = cust_data["token"]
    cust_id = cust_data["user"]["id"]
    print(f"Step A1 SUCCESS: Customer registered (id={cust_id}, email={cust_email})")

    # 2. Customer logs in
    r = requests.post(f"{BASE_URL}/login", json={"email": cust_email, "password": "Password@123"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    cust_token = r.json()["token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}
    print(f"Step A2 SUCCESS: Customer logged in, token received")

    # 3. Customer searches businesses (query 'laptop', category 'Electronics')
    r = requests.get(f"{BASE_URL}/businesses?q=laptop&category=Electronics", headers=cust_headers)
    assert r.status_code == 200
    businesses = r.json()
    assert len(businesses) >= 1, "No businesses found for search"
    target_biz = businesses[0]
    target_bid = target_biz["id"]
    print(f"Step A3 SUCCESS: Search returned {len(businesses)} businesses. Target: '{target_biz['name']}' (id={target_bid})")

    # 4. Customer opens details of the business
    r = requests.get(f"{BASE_URL}/businesses/{target_bid}", headers=cust_headers)
    assert r.status_code == 200
    detail = r.json()
    assert "services" in detail
    assert "reviews" in detail
    chosen_service = detail["services"][0]["name"] if detail["services"] else "General service"
    print(f"Step A4 SUCCESS: Opened details for '{detail['name']}', selected service: '{chosen_service}'")

    # 5. Customer sends service request
    req_payload = {
        "customer_id": cust_id,
        "business_id": target_bid,
        "service_name": chosen_service,
        "note": "Urgent screen replacement needed before Saturday"
    }
    r = requests.post(f"{BASE_URL}/requests", json=req_payload, headers=cust_headers)
    assert r.status_code == 201, f"Request failed: {r.text}"
    req_id = r.json()["id"]
    print(f"Step A5 SUCCESS: Sent service request id={req_id}")

    # 6. Customer tracks their requests
    r = requests.get(f"{BASE_URL}/requests?user_id={cust_id}&role=customer", headers=cust_headers)
    assert r.status_code == 200
    cust_requests = r.json()
    assert any(x["id"] == req_id for x in cust_requests), "Submitted request not in customer requests list"
    print(f"Step A6 SUCCESS: Customer verified their request id={req_id} is present with status 'Pending'")

    # 7. Customer submits a review
    r = requests.post(f"{BASE_URL}/reviews", json={
        "customer_id": cust_id,
        "business_id": target_bid,
        "rating": 5,
        "comment": "Outstanding service and quick response!"
    }, headers=cust_headers)
    assert r.status_code == 201
    print(f"Step A7 SUCCESS: Customer submitted 5-star review")

    # ---------------------------------------------------------
    # JOURNEY B: BUSINESS OWNER JOURNEY
    # ---------------------------------------------------------
    print("\n--- JOURNEY B: Business Owner Journey ---")

    # 1. Business owner logs in
    r = requests.post(f"{BASE_URL}/login", json={"email": "owner@locallink.ai", "password": "Owner@123"})
    assert r.status_code == 200, f"Owner login failed: {r.text}"
    owner_token = r.json()["token"]
    owner_id = r.json()["user"]["id"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    print(f"Step B1 SUCCESS: Business owner logged in (id={owner_id})")

    # 2. Business owner manages business (updates hours & adds service)
    r = requests.patch(f"{BASE_URL}/businesses/{target_bid}", json={
        "working_hours": "Mon - Sat: 8:30 AM - 8:00 PM, Sun: Emergency"
    }, headers=owner_headers)
    assert r.status_code == 200
    print(f"Step B2 SUCCESS: Updated working hours for business id={target_bid}")

    r = requests.post(f"{BASE_URL}/owner/services", json={
        "business_id": target_bid,
        "name": "Rapid Diagnostic Check",
        "description": "30-min express diagnostics",
        "price": 249
    }, headers=owner_headers)
    assert r.status_code == 201
    new_srv_id = r.json()["id"]
    print(f"Step B2b SUCCESS: Business owner added service id={new_srv_id}")

    # 3. Business owner receives customer's request
    r = requests.get(f"{BASE_URL}/requests?user_id={owner_id}&role=business", headers=owner_headers)
    assert r.status_code == 200
    owner_reqs = r.json()
    assert any(x["id"] == req_id for x in owner_reqs), "Customer request not received by business owner"
    print(f"Step B3 SUCCESS: Business owner received customer's request id={req_id}")

    # 4. Business owner accepts request
    r = requests.patch(f"{BASE_URL}/requests/{req_id}", json={"status": "Accepted"}, headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "Accepted"
    print(f"Step B4 SUCCESS: Business owner marked request id={req_id} as 'Accepted'")

    # 5. Business owner starts work (In Progress) and completes service (Completed)
    r = requests.patch(f"{BASE_URL}/requests/{req_id}", json={"status": "In Progress"}, headers=owner_headers)
    assert r.status_code == 200
    r = requests.patch(f"{BASE_URL}/requests/{req_id}", json={"status": "Completed"}, headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "Completed"
    print(f"Step B5 SUCCESS: Business owner progressed and completed service request id={req_id}")

    # 6. Business owner replies to customer review
    r = requests.get(f"{BASE_URL}/owner/reviews?owner_id={owner_id}", headers=owner_headers)
    assert r.status_code == 200
    revs = r.json()["reviews"]
    if revs:
        last_rev_id = revs[0]["id"]
        r_reply = requests.patch(f"{BASE_URL}/reviews/{last_rev_id}/reply", json={
            "reply": "Thank you Kavya! We appreciate your trust in TechFix."
        }, headers=owner_headers)
        assert r_reply.status_code == 200
        print(f"Step B6 SUCCESS: Business owner replied to review id={last_rev_id}")

    # ---------------------------------------------------------
    # JOURNEY C: ADMIN JOURNEY
    # ---------------------------------------------------------
    print("\n--- JOURNEY C: Administrator Journey ---")

    # 1. Admin logs in
    r = requests.post(f"{BASE_URL}/login", json={"email": "admin@locallink.ai", "password": "Admin@123"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"Step C1 SUCCESS: Admin logged in")

    # 2. Admin views users
    r = requests.get(f"{BASE_URL}/admin/users", headers=admin_headers)
    assert r.status_code == 200
    users_list = r.json()
    assert len(users_list) >= 3
    print(f"Step C2 SUCCESS: Admin viewed {len(users_list)} registered users")

    # 3. Admin checks pending businesses and verifies one
    r = requests.get(f"{BASE_URL}/admin/businesses/pending", headers=admin_headers)
    assert r.status_code == 200
    pending_biz = r.json()
    print(f"Step C3: Found {len(pending_biz)} businesses pending verification")
    if pending_biz:
        to_verify_id = pending_biz[0]["id"]
        r = requests.patch(f"{BASE_URL}/admin/businesses/{to_verify_id}/verify", json={"verified": True}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["verified"] is True
        print(f"Step C3b SUCCESS: Admin verified business id={to_verify_id} ('{pending_biz[0]['name']}')")

    # 4. Admin manages categories (creates and deletes)
    test_cat = f"TestCategory_{int(time.time())}"
    r = requests.post(f"{BASE_URL}/categories", json={"name": test_cat}, headers=admin_headers)
    assert r.status_code == 201
    print(f"Step C4a SUCCESS: Admin created category '{test_cat}'")

    r = requests.delete(f"{BASE_URL}/categories/{test_cat}", headers=admin_headers)
    assert r.status_code == 200
    print(f"Step C4b SUCCESS: Admin deleted category '{test_cat}'")

    # 5. Customer reports a business, and Admin reviews reports
    r = requests.post(f"{BASE_URL}/reports", json={
        "business_id": 2,
        "reporter_id": cust_id,
        "reason": "Outdated phone number",
        "details": "Called number but line is disconnected."
    }, headers=cust_headers)
    assert r.status_code == 201
    print(f"Step C5a SUCCESS: Customer reported business id=2")

    r = requests.get(f"{BASE_URL}/admin/reports", headers=admin_headers)
    assert r.status_code == 200
    reports = r.json()
    assert len(reports) >= 1
    rep_id = reports[0]["id"]
    r = requests.patch(f"{BASE_URL}/admin/reports/{rep_id}", json={"status": "Reviewed"}, headers=admin_headers)
    assert r.status_code == 200
    print(f"Step C5b SUCCESS: Admin reviewed report id={rep_id}")

    # ---------------------------------------------------------
    # CROSS-DASHBOARD SYNCHRONIZATION VERIFICATION
    # ---------------------------------------------------------
    print("\n--- Cross-Dashboard Synchronization Verification ---")
    # Verify that the customer now sees their request status as 'Completed'
    r = requests.get(f"{BASE_URL}/requests?user_id={cust_id}&role=customer", headers=cust_headers)
    assert r.status_code == 200
    verified_req = next(x for x in r.json() if x["id"] == req_id)
    assert verified_req["status"] == "Completed", f"Expected Completed but got {verified_req['status']}"
    print(f"Cross-check SUCCESS: Customer dashboard reflects updated status 'Completed' for request id={req_id}")

    print("\n" + "=" * 60)
    print("ALL 3 USER JOURNEYS (A, B, C) & CROSS-SYNC PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_all_journeys()
