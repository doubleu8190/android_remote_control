from dataclasses import dataclass

class WebSocketRequestType:
    CONNECT_DEVICE = "connect_device"

@dataclass
class WebSocketRequest:
    type: WebSocketRequestType
    data: dict

@dataclass
class ConnectDeviceMessage:
    device_ip: str
    device_port: int
    session_id: str

@dataclass
class WebSocketResponse:
    status: bool
    response: str