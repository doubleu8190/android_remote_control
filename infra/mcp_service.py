import requests
from typing import Dict, Any, Optional, List


class MCPService:
    """
    MCP协议服务，用于和外部工具服务器通信
    """

    def __init__(self, server_url: str = "http://localhost:8000"):
        self.server_url = server_url

    def list_tools(self) -> List[Dict[str, Any]]:
        """
        列出所有可用的工具
        """
        try:
            response = requests.get(f"{self.server_url}/tools", timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error listing tools: {e}")
            return []

    def call_tool(self, tool_name: str,
                  args: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用指定的工具
        """
        try:
            response = requests.post(
                f"{self.server_url}/call",
                json={"tool_name": tool_name, "args": args},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error calling tool {tool_name}: {e}")
            return {"error": str(e)}

    def get_tool_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        获取工具的schema
        """
        try:
            response = requests.get(
                f"{self.server_url}/tools/{tool_name}", timeout=30)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error getting tool schema: {e}")
            return None

    def health_check(self) -> bool:
        """
        健康检查
        """
        try:
            response = requests.get(f"{self.server_url}/health", timeout=30)
            return response.status_code == 200
        except Exception as e:
            print(f"Health check failed: {e}")
            return False


# 单例模式
mcp_service = MCPService()
