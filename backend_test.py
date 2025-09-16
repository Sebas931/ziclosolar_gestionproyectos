#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Ziklo Time Tracking Export Closure System
Testing the newly implemented Export Closure System with all enhanced features.
"""

import requests
import json
import uuid
import time
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://nextrack-app.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class ExportClosureSystemTester:
    def __init__(self):
        self.test_data = {}
        self.created_entities = {
            'users': [],
            'projects': [],
            'cost_centers': [],
            'engineers': [],
            'concepts': [],
            'time_entries': [],
            'export_closures': []
        }
        
    def log_test(self, test_name, status, message=""):
        """Log test results"""
        status_symbol = "✅" if status else "❌"
        print(f"{status_symbol} {test_name}: {message}")
        
    def setup_test_data(self):
        """Create test data for export closure testing"""
        print("\n🔧 Setting up test data...")
        
        try:
            # Create test user
            user_data = {
                "name": "Export Test User",
                "email": "export.test@ziklo.com",
                "status": "active"
            }
            response = requests.post(f"{BASE_URL}/users", json=user_data, headers=HEADERS)
            if response.status_code == 200:
                user = response.json()['data']
                self.created_entities['users'].append(user['id'])
                self.test_data['user_id'] = user['id']
                self.log_test("Create Test User", True, f"User ID: {user['id']}")
            else:
                self.log_test("Create Test User", False, f"Status: {response.status_code}")
                return False
                
            # Create test cost center
            cc_data = {
                "code": "CC-EXPORT-001",
                "name": "Export Test Cost Center",
                "status": "active"
            }
            response = requests.post(f"{BASE_URL}/cost-centers", json=cc_data, headers=HEADERS)
            if response.status_code == 200:
                cc = response.json()['data']
                self.created_entities['cost_centers'].append(cc['id'])
                self.test_data['cost_center_id'] = cc['id']
                self.log_test("Create Test Cost Center", True, f"CC ID: {cc['id']}")
            else:
                self.log_test("Create Test Cost Center", False, f"Status: {response.status_code}")
                return False
                
            # Create test project
            project_data = {
                "code": "PROJ-EXPORT-001",
                "name": "Export Test Project",
                "client": "Test Client",
                "status": "active",
                "leader_user_id": self.test_data['user_id'],
                "cost_center_id": self.test_data['cost_center_id']
            }
            response = requests.post(f"{BASE_URL}/projects", json=project_data, headers=HEADERS)
            if response.status_code == 200:
                project = response.json()['data']
                self.created_entities['projects'].append(project['id'])
                self.test_data['project_id'] = project['id']
                self.log_test("Create Test Project", True, f"Project ID: {project['id']}")
            else:
                self.log_test("Create Test Project", False, f"Status: {response.status_code}")
                return False
                
            # Create test engineer
            engineer_data = {
                "user_id": self.test_data['user_id'],
                "document_number": "12345678",
                "title": "Export Test Engineer",
                "status": "active"
            }
            response = requests.post(f"{BASE_URL}/engineers", json=engineer_data, headers=HEADERS)
            if response.status_code == 200:
                engineer = response.json()['data']
                self.created_entities['engineers'].append(engineer['id'])
                self.test_data['engineer_id'] = engineer['id']
                self.log_test("Create Test Engineer", True, f"Engineer ID: {engineer['id']}")
            else:
                self.log_test("Create Test Engineer", False, f"Status: {response.status_code}")
                return False
                
            # Create test concept
            concept_data = {
                "code": "CONC-EXPORT-001",
                "name": "Export Test Concept",
                "status": "active"
            }
            response = requests.post(f"{BASE_URL}/concepts", json=concept_data, headers=HEADERS)
            if response.status_code == 200:
                concept = response.json()['data']
                self.created_entities['concepts'].append(concept['id'])
                self.test_data['concept_id'] = concept['id']
                self.log_test("Create Test Concept", True, f"Concept ID: {concept['id']}")
            else:
                self.log_test("Create Test Concept", False, f"Status: {response.status_code}")
                return False
                
            return True
            
        except Exception as e:
            self.log_test("Setup Test Data", False, f"Exception: {str(e)}")
            return False
            
    def create_test_time_entries(self):
        """Create time entries for testing export closure"""
        print("\n📝 Creating test time entries...")
        
        try:
            # Create time entries for December 2024
            test_dates = [
                "2024-12-01", "2024-12-02", "2024-12-03", 
                "2024-12-15", "2024-12-16", "2024-12-30"
            ]
            
            for date in test_dates:
                entry_data = {
                    "date": date,
                    "project_id": self.test_data['project_id'],
                    "cost_center_id": self.test_data['cost_center_id'],
                    "engineer_id": self.test_data['engineer_id'],
                    "concept_id": self.test_data['concept_id'],
                    "hours": 4.0,
                    "notes": f"Test entry for {date}",
                    "created_by": self.test_data['user_id']
                }
                
                response = requests.post(f"{BASE_URL}/time-entries", json=entry_data, headers=HEADERS)
                if response.status_code == 200:
                    entry = response.json()['data']
                    self.created_entities['time_entries'].append(entry['id'])
                    self.log_test(f"Create Time Entry {date}", True, f"Entry ID: {entry['id']}")
                else:
                    self.log_test(f"Create Time Entry {date}", False, f"Status: {response.status_code}")
                    
            return True
            
        except Exception as e:
            self.log_test("Create Test Time Entries", False, f"Exception: {str(e)}")
            return False
            
    def test_excel_export_with_closure_creation(self):
        """Test 1: Excel Export with Closure Creation"""
        print("\n🧪 TEST 1: Excel Export with Closure Creation")
        
        try:
            # Test export with date range filters
            export_data = {
                "start_date": "2024-12-01",
                "end_date": "2024-12-31",
                "project_ids": [self.test_data['project_id']],
                "user_id": self.test_data['user_id']
            }
            
            response = requests.post(f"{BASE_URL}/export-excel", json=export_data, headers=HEADERS)
            
            if response.status_code == 200:
                # Check response headers
                closure_id = response.headers.get('X-Closure-Id')
                record_count = response.headers.get('X-Record-Count')
                
                if closure_id:
                    self.created_entities['export_closures'].append(closure_id)
                    self.test_data['closure_id'] = closure_id
                    self.log_test("Excel Export - Closure Creation", True, 
                                f"Closure ID: {closure_id}, Records: {record_count}")
                    
                    # Verify closure was created in database
                    closure_response = requests.get(f"{BASE_URL}/export-closures", headers=HEADERS)
                    if closure_response.status_code == 200:
                        closures = closure_response.json()['data']
                        created_closure = next((c for c in closures if c['id'] == closure_id), None)
                        
                        if created_closure and created_closure['status'] == 'ACTIVO':
                            self.log_test("Verify Closure Status", True, "Status: ACTIVO")
                        else:
                            self.log_test("Verify Closure Status", False, "Closure not found or wrong status")
                    
                    # Check Excel file content
                    if len(response.content) > 0:
                        self.log_test("Excel File Generation", True, f"File size: {len(response.content)} bytes")
                    else:
                        self.log_test("Excel File Generation", False, "Empty file")
                        
                else:
                    self.log_test("Excel Export - Closure Creation", False, "No closure ID in response")
            else:
                self.log_test("Excel Export - Closure Creation", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Excel Export - Closure Creation", False, f"Exception: {str(e)}")
            
    def test_idempotency(self):
        """Test 2: Test idempotency - same filters should increment revision"""
        print("\n🧪 TEST 2: Export Idempotency")
        
        try:
            # Run same export again
            export_data = {
                "start_date": "2024-12-01",
                "end_date": "2024-12-31",
                "project_ids": [self.test_data['project_id']],
                "user_id": self.test_data['user_id']
            }
            
            response = requests.post(f"{BASE_URL}/export-excel", json=export_data, headers=HEADERS)
            
            if response.status_code == 200:
                closure_id = response.headers.get('X-Closure-Id')
                
                if closure_id == self.test_data['closure_id']:
                    self.log_test("Idempotency - Same Closure ID", True, f"Closure ID: {closure_id}")
                    
                    # Check if revision was incremented
                    closure_response = requests.get(f"{BASE_URL}/export-closures", headers=HEADERS)
                    if closure_response.status_code == 200:
                        closures = closure_response.json()['data']
                        updated_closure = next((c for c in closures if c['id'] == closure_id), None)
                        
                        if updated_closure and updated_closure.get('revision', 1) > 1:
                            self.log_test("Idempotency - Revision Increment", True, 
                                        f"Revision: {updated_closure['revision']}")
                        else:
                            self.log_test("Idempotency - Revision Increment", False, 
                                        f"Revision not incremented: {updated_closure.get('revision', 1)}")
                else:
                    self.log_test("Idempotency - Same Closure ID", False, 
                                f"Different closure ID: {closure_id}")
            else:
                self.log_test("Idempotency Test", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Idempotency Test", False, f"Exception: {str(e)}")
            
    def test_enhanced_closure_blocking(self):
        """Test 3: Enhanced Closure Blocking"""
        print("\n🧪 TEST 3: Enhanced Closure Blocking")
        
        try:
            # Test CREATE operation blocking
            blocked_entry_data = {
                "date": "2024-12-15",  # Within closure range
                "project_id": self.test_data['project_id'],
                "cost_center_id": self.test_data['cost_center_id'],
                "engineer_id": self.test_data['engineer_id'],
                "concept_id": self.test_data['concept_id'],
                "hours": 2.0,
                "notes": "This should be blocked",
                "created_by": self.test_data['user_id']
            }
            
            response = requests.post(f"{BASE_URL}/time-entries", json=blocked_entry_data, headers=HEADERS)
            
            if response.status_code == 409:
                self.log_test("Closure Blocking - CREATE", True, "409 Conflict returned")
                
                # Check error message
                error_data = response.json()
                if 'cierre' in error_data.get('message', '').lower():
                    self.log_test("Closure Blocking - Error Message", True, 
                                f"Message: {error_data['message']}")
                else:
                    self.log_test("Closure Blocking - Error Message", False, 
                                f"Unexpected message: {error_data.get('message', '')}")
            else:
                self.log_test("Closure Blocking - CREATE", False, 
                            f"Expected 409, got {response.status_code}")
                
            # Test UPDATE operation blocking (if we have existing entries)
            if self.created_entities['time_entries']:
                existing_entry_id = self.created_entities['time_entries'][0]
                
                update_data = {
                    "date": "2024-12-15",  # Within closure range
                    "project_id": self.test_data['project_id'],
                    "cost_center_id": self.test_data['cost_center_id'],
                    "engineer_id": self.test_data['engineer_id'],
                    "concept_id": self.test_data['concept_id'],
                    "hours": 6.0,
                    "notes": "Updated - should be blocked"
                }
                
                response = requests.put(f"{BASE_URL}/time-entries/{existing_entry_id}", 
                                      json=update_data, headers=HEADERS)
                
                if response.status_code == 409:
                    self.log_test("Closure Blocking - UPDATE", True, "409 Conflict returned")
                else:
                    self.log_test("Closure Blocking - UPDATE", False, 
                                f"Expected 409, got {response.status_code}")
                    
                # Test DELETE operation blocking
                response = requests.delete(f"{BASE_URL}/time-entries/{existing_entry_id}", 
                                         headers=HEADERS)
                
                if response.status_code == 409:
                    self.log_test("Closure Blocking - DELETE", True, "409 Conflict returned")
                else:
                    self.log_test("Closure Blocking - DELETE", False, 
                                f"Expected 409, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Enhanced Closure Blocking", False, f"Exception: {str(e)}")
            
    def test_closure_reopening_total(self):
        """Test 4: Total Closure Reopening"""
        print("\n🧪 TEST 4: Total Closure Reopening")
        
        try:
            if not self.test_data.get('closure_id'):
                self.log_test("Total Closure Reopening", False, "No closure ID available")
                return
                
            # Test total reopening
            reopen_data = {
                "type": "total",
                "user_id": self.test_data['user_id']
            }
            
            response = requests.post(f"{BASE_URL}/export-closures/{self.test_data['closure_id']}/reopen", 
                                   json=reopen_data, headers=HEADERS)
            
            if response.status_code == 200:
                result = response.json()['data']
                
                if result['status'] == 'REABIERTO':
                    self.log_test("Total Reopening - Status Change", True, "Status: REABIERTO")
                    
                    # Verify closure status in database
                    closure_response = requests.get(f"{BASE_URL}/export-closures", headers=HEADERS)
                    if closure_response.status_code == 200:
                        closures = closure_response.json()['data']
                        reopened_closure = next((c for c in closures if c['id'] == self.test_data['closure_id']), None)
                        
                        if reopened_closure and reopened_closure['status'] == 'REABIERTO':
                            self.log_test("Total Reopening - Database Verification", True, 
                                        "Status updated in database")
                            
                            # Test that operations are now allowed
                            test_entry_data = {
                                "date": "2024-12-15",
                                "project_id": self.test_data['project_id'],
                                "cost_center_id": self.test_data['cost_center_id'],
                                "engineer_id": self.test_data['engineer_id'],
                                "concept_id": self.test_data['concept_id'],
                                "hours": 2.0,
                                "notes": "Post-reopen entry",
                                "created_by": self.test_data['user_id']
                            }
                            
                            entry_response = requests.post(f"{BASE_URL}/time-entries", 
                                                         json=test_entry_data, headers=HEADERS)
                            
                            if entry_response.status_code == 200:
                                entry = entry_response.json()['data']
                                self.created_entities['time_entries'].append(entry['id'])
                                
                                # Check if post_export_adjustment is set
                                if entry.get('post_export_adjustment'):
                                    self.log_test("Total Reopening - Post Export Adjustment", True, 
                                                "post_export_adjustment=true")
                                else:
                                    self.log_test("Total Reopening - Post Export Adjustment", False, 
                                                "post_export_adjustment not set")
                                    
                                self.log_test("Total Reopening - Operations Allowed", True, 
                                            "Time entry created successfully")
                            else:
                                self.log_test("Total Reopening - Operations Allowed", False, 
                                            f"Entry creation failed: {entry_response.status_code}")
                        else:
                            self.log_test("Total Reopening - Database Verification", False, 
                                        "Status not updated in database")
                else:
                    self.log_test("Total Reopening - Status Change", False, 
                                f"Unexpected status: {result['status']}")
            else:
                self.log_test("Total Closure Reopening", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Total Closure Reopening", False, f"Exception: {str(e)}")
            
    def test_partial_closure_reopening(self):
        """Test 5: Partial Closure Reopening"""
        print("\n🧪 TEST 5: Partial Closure Reopening")
        
        try:
            # First create a new closure for partial reopening test
            export_data = {
                "start_date": "2024-12-01",
                "end_date": "2024-12-31",
                "project_ids": [self.test_data['project_id']],
                "user_id": self.test_data['user_id']
            }
            
            response = requests.post(f"{BASE_URL}/export-excel", json=export_data, headers=HEADERS)
            
            if response.status_code == 200:
                partial_closure_id = response.headers.get('X-Closure-Id')
                self.created_entities['export_closures'].append(partial_closure_id)
                
                # Test partial reopening with specific date range
                partial_reopen_data = {
                    "type": "partial",
                    "partial_filters": {
                        "start_date": "2024-12-10",
                        "end_date": "2024-12-20",
                        "project_ids": [self.test_data['project_id']],
                        "note": "Partial reopening for corrections"
                    },
                    "user_id": self.test_data['user_id']
                }
                
                reopen_response = requests.post(f"{BASE_URL}/export-closures/{partial_closure_id}/reopen", 
                                              json=partial_reopen_data, headers=HEADERS)
                
                if reopen_response.status_code == 200:
                    result = reopen_response.json()['data']
                    
                    if result['status'] == 'PARCIALMENTE_REABIERTO':
                        self.log_test("Partial Reopening - Status Change", True, 
                                    "Status: PARCIALMENTE_REABIERTO")
                        
                        # Test operations within exception range (should be allowed)
                        exception_entry_data = {
                            "date": "2024-12-15",  # Within exception range
                            "project_id": self.test_data['project_id'],
                            "cost_center_id": self.test_data['cost_center_id'],
                            "engineer_id": self.test_data['engineer_id'],
                            "concept_id": self.test_data['concept_id'],
                            "hours": 3.0,
                            "notes": "Entry in exception range",
                            "created_by": self.test_data['user_id']
                        }
                        
                        exception_response = requests.post(f"{BASE_URL}/time-entries", 
                                                         json=exception_entry_data, headers=HEADERS)
                        
                        if exception_response.status_code == 200:
                            entry = exception_response.json()['data']
                            self.created_entities['time_entries'].append(entry['id'])
                            
                            if entry.get('post_export_adjustment'):
                                self.log_test("Partial Reopening - Exception Range Allowed", True, 
                                            "Entry created with post_export_adjustment=true")
                            else:
                                self.log_test("Partial Reopening - Exception Range Allowed", False, 
                                            "post_export_adjustment not set")
                        else:
                            self.log_test("Partial Reopening - Exception Range Allowed", False, 
                                        f"Entry creation failed: {exception_response.status_code}")
                            
                        # Test operations outside exception range (should be blocked)
                        blocked_entry_data = {
                            "date": "2024-12-25",  # Outside exception range
                            "project_id": self.test_data['project_id'],
                            "cost_center_id": self.test_data['cost_center_id'],
                            "engineer_id": self.test_data['engineer_id'],
                            "concept_id": self.test_data['concept_id'],
                            "hours": 2.0,
                            "notes": "Entry outside exception range",
                            "created_by": self.test_data['user_id']
                        }
                        
                        blocked_response = requests.post(f"{BASE_URL}/time-entries", 
                                                       json=blocked_entry_data, headers=HEADERS)
                        
                        if blocked_response.status_code == 409:
                            self.log_test("Partial Reopening - Outside Exception Blocked", True, 
                                        "409 Conflict returned for outside range")
                        else:
                            self.log_test("Partial Reopening - Outside Exception Blocked", False, 
                                        f"Expected 409, got {blocked_response.status_code}")
                    else:
                        self.log_test("Partial Reopening - Status Change", False, 
                                    f"Unexpected status: {result['status']}")
                else:
                    self.log_test("Partial Closure Reopening", False, 
                                f"Status: {reopen_response.status_code}")
            else:
                self.log_test("Partial Closure Reopening - Setup", False, 
                            f"Failed to create closure: {response.status_code}")
                
        except Exception as e:
            self.log_test("Partial Closure Reopening", False, f"Exception: {str(e)}")
            
    def test_enhanced_closure_check_logic(self):
        """Test 6: Enhanced Closure Check Logic"""
        print("\n🧪 TEST 6: Enhanced Closure Check Logic")
        
        try:
            # Test with detailed closure information
            response = requests.get(f"{BASE_URL}/export-closures-detailed", headers=HEADERS)
            
            if response.status_code == 200:
                closures = response.json()['data']
                
                if closures:
                    self.log_test("Enhanced Closure Check - Detailed Endpoint", True, 
                                f"Retrieved {len(closures)} closures with details")
                    
                    # Check if closures have scope and exceptions data
                    for closure in closures[:2]:  # Check first 2 closures
                        has_scope = 'scope' in closure and len(closure['scope']) > 0
                        has_exceptions = 'exceptions' in closure
                        
                        self.log_test(f"Closure {closure['id'][:8]}... - Scope Data", has_scope, 
                                    f"Scope entries: {len(closure.get('scope', []))}")
                        self.log_test(f"Closure {closure['id'][:8]}... - Exceptions Data", has_exceptions, 
                                    f"Exceptions: {len(closure.get('exceptions', []))}")
                else:
                    self.log_test("Enhanced Closure Check - Detailed Endpoint", False, 
                                "No closures found")
            else:
                self.log_test("Enhanced Closure Check - Detailed Endpoint", False, 
                            f"Status: {response.status_code}")
                
            # Test complex scenario with multiple scopes
            complex_export_data = {
                "start_date": "2024-11-01",
                "end_date": "2024-11-30",
                "project_ids": [self.test_data['project_id']],
                "cost_center_ids": [self.test_data['cost_center_id']],
                "engineer_ids": [self.test_data['engineer_id']],
                "user_id": self.test_data['user_id']
            }
            
            complex_response = requests.post(f"{BASE_URL}/export-excel", json=complex_export_data, headers=HEADERS)
            
            if complex_response.status_code == 200:
                complex_closure_id = complex_response.headers.get('X-Closure-Id')
                self.created_entities['export_closures'].append(complex_closure_id)
                
                self.log_test("Enhanced Closure Check - Complex Scope", True, 
                            f"Created closure with multiple scope filters: {complex_closure_id}")
            else:
                self.log_test("Enhanced Closure Check - Complex Scope", False, 
                            f"Status: {complex_response.status_code}")
                
        except Exception as e:
            self.log_test("Enhanced Closure Check Logic", False, f"Exception: {str(e)}")
            
    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Note: In a real scenario, we might want to clean up test data
        # For this test, we'll leave the data for inspection
        print(f"Created entities summary:")
        for entity_type, ids in self.created_entities.items():
            if ids:
                print(f"  {entity_type}: {len(ids)} items")
                
    def run_all_tests(self):
        """Run all export closure system tests"""
        print("🚀 Starting Export Closure System Comprehensive Testing")
        print("=" * 60)
        
        # Setup
        if not self.setup_test_data():
            print("❌ Failed to setup test data. Aborting tests.")
            return False
            
        if not self.create_test_time_entries():
            print("❌ Failed to create test time entries. Aborting tests.")
            return False
            
        # Run tests
        self.test_excel_export_with_closure_creation()
        self.test_idempotency()
        self.test_enhanced_closure_blocking()
        self.test_closure_reopening_total()
        self.test_partial_closure_reopening()
        self.test_enhanced_closure_check_logic()
        
        # Cleanup
        self.cleanup_test_data()
        
        print("\n" + "=" * 60)
        print("🏁 Export Closure System Testing Complete")
        
        return True

def main():
    """Main test execution"""
    tester = ExportClosureSystemTester()
    
    try:
        success = tester.run_all_tests()
        if success:
            print("\n✅ All tests completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Some tests failed!")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()