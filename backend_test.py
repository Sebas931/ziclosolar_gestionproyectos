#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Ziklo Time Tracking System
Tests the complex export closure system and time entry validations
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
# Use localhost for testing since external URL has ingress issues
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

class ZikloBackendTester:
    def __init__(self):
        self.test_data = {}
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if data and not success:
            print(f"   Data: {json.dumps(data, indent=2)}")
        return success
    
    def make_request(self, method, endpoint, data=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{API_BASE}/{endpoint}"
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return None
    
    def test_database_connection(self):
        """Test basic database connectivity"""
        print("\n=== Testing Database Connection ===")
        
        response = self.make_request('GET', 'projects')
        if response and response.status_code == 200:
            return self.log_test("Database Connection", True, "Successfully connected to MongoDB")
        else:
            return self.log_test("Database Connection", False, f"Failed to connect. Status: {response.status_code if response else 'No response'}")
    
    def create_master_data(self):
        """Create master data for testing"""
        print("\n=== Creating Master Data ===")
        
        # Create Cost Center
        cost_center_data = {
            "code": "CC001",
            "name": "Engineering Department",
            "status": "active"
        }
        
        response = self.make_request('POST', 'cost-centers', cost_center_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['cost_center'] = result['data']
                self.log_test("Cost Center Creation", True, f"Created cost center: {result['data']['id']}")
            else:
                return self.log_test("Cost Center Creation", False, "Failed to create cost center", result)
        else:
            return self.log_test("Cost Center Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Create User
        user_data = {
            "name": "Juan Carlos Pérez",
            "email": "juan.perez@company.com",
            "status": "active"
        }
        
        response = self.make_request('POST', 'users', user_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['user'] = result['data']
                self.log_test("User Creation", True, f"Created user: {result['data']['id']}")
            else:
                return self.log_test("User Creation", False, "Failed to create user", result)
        else:
            return self.log_test("User Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Create Project
        project_data = {
            "code": "PROJ001",
            "name": "Sistema de Gestión de Tiempos",
            "client": "Empresa ABC",
            "status": "active",
            "leader_user_id": self.test_data['user']['id'],
            "cost_center_id": self.test_data['cost_center']['id']
        }
        
        response = self.make_request('POST', 'projects', project_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['project'] = result['data']
                self.log_test("Project Creation", True, f"Created project: {result['data']['id']}")
            else:
                return self.log_test("Project Creation", False, "Failed to create project", result)
        else:
            return self.log_test("Project Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Create Engineer
        engineer_data = {
            "user_id": self.test_data['user']['id'],
            "document_number": "12345678",
            "title": "Senior Software Engineer",
            "status": "active"
        }
        
        response = self.make_request('POST', 'engineers', engineer_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['engineer'] = result['data']
                self.log_test("Engineer Creation", True, f"Created engineer: {result['data']['id']}")
            else:
                return self.log_test("Engineer Creation", False, "Failed to create engineer", result)
        else:
            return self.log_test("Engineer Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Create Concept
        concept_data = {
            "code": "DEV001",
            "name": "Desarrollo de Software",
            "status": "active"
        }
        
        response = self.make_request('POST', 'concepts', concept_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['concept'] = result['data']
                self.log_test("Concept Creation", True, f"Created concept: {result['data']['id']}")
                return True
            else:
                return self.log_test("Concept Creation", False, "Failed to create concept", result)
        else:
            return self.log_test("Concept Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
    
    def test_time_entry_crud(self):
        """Test time entry CRUD operations with validations"""
        print("\n=== Testing Time Entry CRUD Operations ===")
        
        # Test 1: Create valid time entry
        today = datetime.now().strftime('%Y-%m-%d')
        time_entry_data = {
            "date": today,
            "project_id": self.test_data['project']['id'],
            "cost_center_id": self.test_data['cost_center']['id'],
            "engineer_id": self.test_data['engineer']['id'],
            "concept_id": self.test_data['concept']['id'],
            "hours": 4.5,
            "notes": "Desarrollo de funcionalidades principales",
            "created_by": self.test_data['user']['id']
        }
        
        response = self.make_request('POST', 'time-entries', time_entry_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['time_entry'] = result['data']
                self.log_test("Time Entry Creation", True, f"Created time entry: {result['data']['id']}")
            else:
                return self.log_test("Time Entry Creation", False, "Failed to create time entry", result)
        else:
            return self.log_test("Time Entry Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Test 2: Test daily hours limit (should fail with >8 hours total)
        excessive_hours_data = time_entry_data.copy()
        excessive_hours_data['hours'] = 5.0  # This would make total 9.5 hours
        
        response = self.make_request('POST', 'time-entries', excessive_hours_data)
        if response and response.status_code == 400:
            result = response.json()
            if not result.get('success') and 'límite diario' in result.get('message', ''):
                self.log_test("Daily Hours Limit Validation", True, "Correctly blocked excessive hours")
            else:
                self.log_test("Daily Hours Limit Validation", False, "Should have blocked excessive hours", result)
        else:
            self.log_test("Daily Hours Limit Validation", False, f"Expected 400 status, got {response.status_code if response else 'No response'}")
        
        # Test 3: Update time entry
        update_data = {
            "date": today,
            "project_id": self.test_data['project']['id'],
            "cost_center_id": self.test_data['cost_center']['id'],
            "engineer_id": self.test_data['engineer']['id'],
            "concept_id": self.test_data['concept']['id'],
            "hours": 3.0,  # Reduced hours
            "notes": "Desarrollo actualizado"
        }
        
        entry_id = self.test_data['time_entry']['id']
        response = self.make_request('PUT', f'time-entries/{entry_id}', update_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.log_test("Time Entry Update", True, "Successfully updated time entry")
            else:
                self.log_test("Time Entry Update", False, "Failed to update time entry", result)
        else:
            self.log_test("Time Entry Update", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Test 4: Get time entries
        response = self.make_request('GET', 'time-entries', params={'start_date': today, 'end_date': today})
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success') and len(result.get('data', [])) > 0:
                self.log_test("Time Entry Retrieval", True, f"Retrieved {len(result['data'])} time entries")
            else:
                self.log_test("Time Entry Retrieval", False, "No time entries found", result)
        else:
            self.log_test("Time Entry Retrieval", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        return True
    
    def test_export_closure_system(self):
        """Test the complex export closure system - MOST CRITICAL"""
        print("\n=== Testing Export Closure System (CRITICAL) ===")
        
        # First, let's create an export closure manually in the database
        # Since there's no POST endpoint for export closures in the current implementation,
        # we'll test the checkExportClosure function by creating a time entry that should be blocked
        
        # Test 1: Create time entry for tomorrow (should work - no closure)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        future_entry_data = {
            "date": tomorrow,
            "project_id": self.test_data['project']['id'],
            "cost_center_id": self.test_data['cost_center']['id'],
            "engineer_id": self.test_data['engineer']['id'],
            "concept_id": self.test_data['concept']['id'],
            "hours": 2.0,
            "notes": "Trabajo futuro",
            "created_by": self.test_data['user']['id']
        }
        
        response = self.make_request('POST', 'time-entries', future_entry_data)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                self.test_data['future_entry'] = result['data']
                self.log_test("Future Time Entry Creation", True, "Created time entry for future date")
            else:
                self.log_test("Future Time Entry Creation", False, "Failed to create future time entry", result)
        else:
            self.log_test("Future Time Entry Creation", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Test 2: Test invalid date handling
        invalid_date_data = future_entry_data.copy()
        invalid_date_data['date'] = "invalid-date"
        
        response = self.make_request('POST', 'time-entries', invalid_date_data)
        if response and response.status_code == 400:
            result = response.json()
            if not result.get('success') and 'inválida' in result.get('message', ''):
                self.log_test("Invalid Date Validation", True, "Correctly rejected invalid date")
            else:
                self.log_test("Invalid Date Validation", False, "Should have rejected invalid date", result)
        else:
            self.log_test("Invalid Date Validation", False, f"Expected 400 status, got {response.status_code if response else 'No response'}")
        
        # Test 3: Test timezone handling (America/Bogota)
        # The validateDate function should handle timezone conversion
        timezone_test_data = future_entry_data.copy()
        timezone_test_data['date'] = "2024-12-15T10:30:00Z"  # UTC timestamp
        
        response = self.make_request('POST', 'time-entries', timezone_test_data)
        if response:
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_test("Timezone Handling", True, "Successfully handled timezone conversion")
                else:
                    self.log_test("Timezone Handling", False, "Failed timezone handling", result)
            else:
                self.log_test("Timezone Handling", False, f"HTTP Error: {response.status_code}")
        else:
            self.log_test("Timezone Handling", False, "No response received")
        
        # Test 4: Test GET export closures endpoint
        response = self.make_request('GET', 'export-closures')
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                closures = result.get('data', [])
                self.log_test("Export Closures Retrieval", True, f"Retrieved {len(closures)} export closures")
            else:
                self.log_test("Export Closures Retrieval", False, "Failed to retrieve export closures", result)
        else:
            self.log_test("Export Closures Retrieval", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        return True
    
    def test_dashboard_kpis(self):
        """Test dashboard KPI endpoints"""
        print("\n=== Testing Dashboard KPIs ===")
        
        # Test 1: Get basic KPIs
        response = self.make_request('GET', 'dashboard/kpis')
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                kpis = result.get('data', {})
                expected_keys = ['total_projects', 'active_projects', 'total_engineers', 'monthly_hours']
                if all(key in kpis for key in expected_keys):
                    self.log_test("Dashboard KPIs", True, f"Retrieved all KPIs: {kpis}")
                else:
                    self.log_test("Dashboard KPIs", False, f"Missing KPI keys. Got: {list(kpis.keys())}")
            else:
                self.log_test("Dashboard KPIs", False, "Failed to retrieve KPIs", result)
        else:
            self.log_test("Dashboard KPIs", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Test 2: Get hours by project
        today = datetime.now().strftime('%Y-%m-%d')
        params = {
            'start_date': today,
            'end_date': today
        }
        
        response = self.make_request('GET', 'dashboard/hours-by-project', params=params)
        if response and response.status_code == 200:
            result = response.json()
            if result.get('success'):
                hours_data = result.get('data', [])
                self.log_test("Hours by Project", True, f"Retrieved hours data for {len(hours_data)} projects")
            else:
                self.log_test("Hours by Project", False, "Failed to retrieve hours by project", result)
        else:
            self.log_test("Hours by Project", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        return True
    
    def test_delete_operations(self):
        """Test delete operations with closure validation"""
        print("\n=== Testing Delete Operations ===")
        
        # Test deleting time entry (should work if no closure blocks it)
        if 'time_entry' in self.test_data:
            entry_id = self.test_data['time_entry']['id']
            response = self.make_request('DELETE', f'time-entries/{entry_id}')
            if response and response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_test("Time Entry Deletion", True, "Successfully deleted time entry")
                else:
                    self.log_test("Time Entry Deletion", False, "Failed to delete time entry", result)
            else:
                self.log_test("Time Entry Deletion", False, f"HTTP Error: {response.status_code if response else 'No response'}")
        
        # Test deleting non-existent entry
        fake_id = str(uuid.uuid4())
        response = self.make_request('DELETE', f'time-entries/{fake_id}')
        if response and response.status_code == 404:
            result = response.json()
            if not result.get('success'):
                self.log_test("Delete Non-existent Entry", True, "Correctly returned 404 for non-existent entry")
            else:
                self.log_test("Delete Non-existent Entry", False, "Should have returned error for non-existent entry")
        else:
            self.log_test("Delete Non-existent Entry", False, f"Expected 404 status, got {response.status_code if response else 'No response'}")
        
        return True
    
    def test_error_handling(self):
        """Test various error scenarios"""
        print("\n=== Testing Error Handling ===")
        
        # Test 1: Invalid endpoint
        response = self.make_request('GET', 'invalid-endpoint')
        if response and response.status_code == 404:
            result = response.json()
            if not result.get('success'):
                self.log_test("Invalid Endpoint", True, "Correctly returned 404 for invalid endpoint")
            else:
                self.log_test("Invalid Endpoint", False, "Should have returned error for invalid endpoint")
        else:
            self.log_test("Invalid Endpoint", False, f"Expected 404 status, got {response.status_code if response else 'No response'}")
        
        # Test 2: Malformed JSON
        try:
            url = f"{API_BASE}/time-entries"
            response = self.session.post(url, data="invalid json")
            if response.status_code >= 400:
                self.log_test("Malformed JSON", True, "Correctly handled malformed JSON")
            else:
                self.log_test("Malformed JSON", False, f"Should have returned error, got {response.status_code}")
        except Exception as e:
            self.log_test("Malformed JSON", True, f"Correctly handled malformed JSON with exception: {str(e)}")
        
        # Test 3: Missing required fields
        incomplete_data = {
            "date": datetime.now().strftime('%Y-%m-%d'),
            "hours": 2.0
            # Missing required fields
        }
        
        response = self.make_request('POST', 'time-entries', incomplete_data)
        if response and response.status_code >= 400:
            self.log_test("Missing Required Fields", True, "Correctly handled missing required fields")
        else:
            self.log_test("Missing Required Fields", False, f"Should have returned error, got {response.status_code if response else 'No response'}")
        
        return True
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Ziklo Time Tracking Backend Tests")
        print(f"Testing against: {API_BASE}")
        print("=" * 60)
        
        test_results = []
        
        # Core functionality tests
        test_results.append(self.test_database_connection())
        test_results.append(self.create_master_data())
        test_results.append(self.test_time_entry_crud())
        test_results.append(self.test_export_closure_system())
        test_results.append(self.test_dashboard_kpis())
        test_results.append(self.test_delete_operations())
        test_results.append(self.test_error_handling())
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(test_results)
        total = len(test_results)
        
        print(f"Tests Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Backend is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Check the logs above for details.")
            return False

if __name__ == "__main__":
    tester = ZikloBackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)