import requests
import json

# 测试登录
def test_login():
    url = "http://localhost:8000/api/auth/login"
    data = {
        "username": "root",
        "password": "123456"
    }
    response = requests.post(url, data=data)
    print("Login response:", response.json())
    return response.json().get("access_token")

# 测试创建会话
def test_create_session(token):
    url = "http://localhost:8000/api/sessions/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "title": "测试会话"
    }
    response = requests.post(url, headers=headers, json=data)
    print("Create session response:", response.json())
    return response.json()

# 测试连接设备
def test_connect_device(token, session_id):
    url = "http://localhost:8000/api/sessions/device/connect"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "ip": "192.168.31.113",
        "port": 5555,
        "session_id": session_id
    }
    response = requests.post(url, headers=headers, json=data)
    print("Connect device response:", response.json())
    return response.json()

# 测试删除会话
def test_delete_session(token, session_id):
    url = f"http://localhost:8000/api/sessions/{session_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.delete(url, headers=headers)
    print("Delete session response:", response.json())
    return response.json()

if __name__ == "__main__":
    # 测试登录
    token = test_login()
    if token:
        # 测试创建会话
        create_response = test_create_session(token)
        if "id" in create_response:
            session_id = create_response["id"]
            print(f"Created session ID: {session_id}")
            
            # 测试连接设备，传递数据库会话ID
            print(f"传递给test_connect_device的session_id: {session_id}")
            connect_response = test_connect_device(token, session_id)
            if connect_response.get("status") == "success":
                device_session_id = connect_response.get("session_id")
                print(f"Device session ID: {device_session_id}")
                
                # 测试删除数据库会话
                test_delete_session(token, session_id)

