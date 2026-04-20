import asyncio
import logging
from math import log
import subprocess  # nosec: B404 - subprocess用于启动外部进程，需要安全使用
import json
import websockets
from typing import Optional, Dict, Any
from .port_allocator import port_allocator


class ScrcpyService:
    """单个scrcpy服务实例"""

    # 连接状态枚举
    class ConnectionStatus:
        DISCONNECTED = "disconnected"
        CONNECTING = "connecting"
        CONNECTED = "connected"
        FAILED = "failed"

    def __init__(self, session_id: str, device_ip: str, device_port: int):
        self.session_id = session_id
        self.device_ip = device_ip
        self.device_port = device_port
        self.process: subprocess.Popen | None = None
        self.ws_port: int | None = None
        self.running: bool = False
        self.clients = set()
        self.ws_server = None
        self.stderr_task: asyncio.Task | None = None
        self.connection_status = self.ConnectionStatus.DISCONNECTED
        self.error_message: str | None = None

    async def adb_connect(self) -> bool:
        """连接Android设备"""
        try:
            result = subprocess.run(
                ["adb", "connect", f"{self.device_ip}:{self.device_port}"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0 and "connected" in result.stdout.lower():
                logging.info(f"ADB连接成功: {self.device_ip}:{self.device_port}")
                await asyncio.sleep(1)  # 等待连接稳定
                return True
            else:
                logging.error(f"ADB连接失败: {result.stderr or result.stdout}")
                return False
        except Exception as e:
            logging.error(f"ADB连接异常: {e}")
            return False

    async def check_adb_device(self) -> bool:
        """检查ADB设备是否已连接"""
        try:
            result = subprocess.run(
                "adb devices", shell=True, capture_output=True, text=True
            )

            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                for line in lines:
                    if self.device_ip in line and "device" in line:
                        logging.info(f"ADB设备已连接: {line.strip()}")
                        return True
            return False
        except Exception as e:
            logging.error(f"检查ADB设备异常: {e}")
            return False

    async def handle_stderr(self):
        """处理scrcpy进程的stderr输出"""
        if not self.process:
            return

        try:
            while self.process and self.process.poll() is None:
                try:
                    error = await asyncio.to_thread(self.process.stderr.readline)
                    if not error:
                        break
                    logging.warning(
                        f"scrcpy stderr: {
                            error.decode('utf-8', errors='ignore').strip()
                        }"
                    )
                except Exception as e:
                    logging.error(f"读取scrcpy stderr时出错: {e}")
                    break
        except Exception as e:
            logging.error(f"处理scrcpy stderr时出错: {e}")

    async def handle_client(self, websocket):
        """处理WebSocket客户端连接"""
        client_id = id(websocket)
        logging.info(f"新的视频流客户端连接: {client_id}")

        # 添加客户端到集合
        self.clients.add(websocket)

        try:
            # 确保scrcpy服务正在运行
            if not self.is_running():
                await websocket.send(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "无法启动屏幕镜像：scrcpy服务未运行",
                        }
                    )
                )
                return

            # 发送连接成功消息
            await websocket.send(
                json.dumps({"type": "info", "message": "连接成功，开始传输视频流"})
            )
            logging.info(f"客户端连接成功: {client_id}，并成功发送连接成功提示消息")
            # 发送视频流
            while self.process and self.process.poll() is None:
                try:
                    # 读取视频数据（异步方式，避免阻塞事件循环）
                    logging.debug("尝试读取视频数据")
                    try:
                        # 使用asyncio.to_thread在后台线程中执行同步读取操作
                        data = await asyncio.to_thread(self.process.stdout.read, 4096)
                    except Exception as read_error:
                        logging.error(f"读取视频数据时出错: {read_error}")
                        break
                    
                    if not data:
                        logging.warning("视频流数据为空，可能scrcpy已停止")
                        break

                    # 发送给客户端
                    logging.debug(f"发送视频数据: {len(data)} 字节")
                    try:
                        # 添加超时控制，避免发送操作阻塞
                        await asyncio.wait_for(websocket.send(data), timeout=1.0)
                    except asyncio.TimeoutError:
                        logging.error("发送视频数据超时，客户端可能已断开")
                        break
                    except websockets.exceptions.ConnectionClosed:
                        logging.info(f"客户端断开连接: {client_id}")
                        break

                    # 添加小的延迟避免CPU占用过高
                    await asyncio.sleep(0.001)

                except websockets.exceptions.ConnectionClosed:
                    logging.info(f"客户端断开连接: {client_id}")
                    break
                except websockets.exceptions.WebSocketException as e:
                    logging.error(f"WebSocket错误: {e}")
                    break
                except Exception as e:
                    logging.error(f"视频流传输错误: {e}")
                    break

        except Exception as e:
            logging.error(f"处理客户端异常: {e}")
            try:
                await websocket.send(
                    json.dumps(
                        {"type": "error", "message": f"处理连接时出错: {str(e)}"}
                    )
                )
            except BaseException:
                pass
        finally:
            # 清理客户端连接
            self.clients.discard(websocket)
            logging.info(f"客户端连接关闭: {client_id}")

            # 如果没有客户端连接，考虑停止服务
            if len(self.clients) == 0:
                logging.info("无客户端连接，考虑停止scrcpy服务")
                # 这里可以添加自动停止服务的逻辑
                # await self.stop()

    async def start(self) -> int:
        """启动scrcpy服务并返回WebSocket端口"""
        # 确保端口在任何情况下都能被释放
        allocated_port = None

        try:
            # 设置连接状态为连接中
            self.connection_status = self.ConnectionStatus.CONNECTING
            self.error_message = None

            # 检查并连接ADB设备
            if not await self.check_adb_device():
                logging.warning("ADB设备未连接，尝试连接...")
                if not await self.adb_connect():
                    self.connection_status = self.ConnectionStatus.FAILED
                    self.error_message = (
                        f"无法连接ADB设备: {self.device_ip}:{self.device_port}"
                    )
                    raise RuntimeError(
                        f"无法连接ADB设备: {self.device_ip}:{self.device_port}"
                    )

            # 分配WebSocket端口
            allocated_port = port_allocator.allocate_port(
                session_id=self.session_id, preferred_port=None
            )
            if allocated_port is None:
                raise RuntimeError("无法分配WebSocket端口")

            # 保存分配的端口
            self.ws_port = allocated_port

            # 构建scrcpy命令
            cmd = [
                "scrcpy",
                "-s",
                f"{self.device_ip}:{self.device_port}",
                "--no-audio",
                "--no-window",
                "--record", "-",
                "--record-format", "mkv",
                "-m", "800",
                "--max-fps", "30",
                "--video-bit-rate", "4M",
                "--video-codec", "h264",
                "--capture-orientation", "0",
                "--no-control",
                "--render-driver=opengl",
                "--no-playback",  # 替代--no-display，确保不显示窗口，只输出到stdout
                "--push-target", "/data/local/tmp/",  # 指定推送目标
                "--force-adb-forward"  # 强制ADB转发
            ]

            # 启动scrcpy进程
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=1024 * 1024,
            )
            logging.info(
                f"启动scrcpy服务，pid: {self.process.pid}，设备: {self.device_ip}:{self.device_port}"
            )

            # 启动stderr处理任务
            self.stderr_task = asyncio.create_task(self.handle_stderr())

            # 检查scrcpy进程是否正常启动
            logging.info(f"等待scrcpy进程启动，pid: {self.process.pid}")
            await asyncio.sleep(5)  # 等待进程启动
            logging.info(f"scrcpy进程启动检查，pid: {self.process.pid}")
            if self.process.poll() is not None:
                raise RuntimeError(
                    f"scrcpy进程启动失败，退出码: {self.process.returncode}"
                )

            # 启动WebSocket服务器
            try:
                logging.info(f"准备启动WebSocket服务器，监听端口: {self.ws_port}")
                self.ws_server = await websockets.serve(
                    self.handle_client,
                    "0.0.0.0",
                    self.ws_port,  # nosec B104
                )
            except Exception as ws_error:
                logging.error(f"启动WebSocket服务器失败: {ws_error}")
                raise

            self.running = True
            self.connection_status = self.ConnectionStatus.CONNECTED
            logging.info(f"scrcpy服务已启动 (PID: {self.process.pid})")
            logging.info(f"WebSocket服务器已启动，监听端口: {self.ws_port}")

            return self.ws_port

        except Exception as e:
            logging.error(f"启动scrcpy服务失败: {e}")
            # 设置连接状态为失败
            self.connection_status = self.ConnectionStatus.FAILED
            self.error_message = str(e)
            # 释放端口
            if allocated_port is not None:
                try:
                    port_allocator.release_port(allocated_port)
                    logging.info(f"已释放WebSocket端口: {allocated_port}")
                except Exception as release_error:
                    logging.error(f"释放端口 {allocated_port} 时出错: {release_error}")
            # 清理进程
            if self.process:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=5)
                except Exception as proc_error:
                    logging.error(f"停止进程时出错: {proc_error}")
            # 清理任务
            if self.stderr_task:
                try:
                    self.stderr_task.cancel()
                    await asyncio.gather(self.stderr_task, return_exceptions=True)
                except Exception as task_error:
                    logging.error(f"取消任务时出错: {task_error}")
            # 重置状态
            self.process = None
            self.ws_server = None
            self.stderr_task = None
            self.ws_port = None
            self.running = False
            raise

    async def stop(self):
        """停止scrcpy服务"""
        if self.running:
            logging.info(
                f"停止scrcpy服务 (PID: {self.process.pid if self.process else 'N/A'})"
            )

            # 关闭WebSocket服务器
            if self.ws_server:
                try:
                    self.ws_server.close()
                    await self.ws_server.wait_closed()
                    logging.info("WebSocket服务器已关闭")
                except Exception as e:
                    logging.error(f"关闭WebSocket服务器时出错: {e}")

            # 停止scrcpy进程
            if self.process and self.process.poll() is None:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logging.warning("scrcpy服务未响应，强制终止")
                    self.process.kill()
                    self.process.wait()

            # 取消stderr处理任务
            if self.stderr_task:
                try:
                    self.stderr_task.cancel()
                    await asyncio.gather(self.stderr_task, return_exceptions=True)
                    logging.info("stderr处理任务已取消")
                except Exception as e:
                    logging.error(f"取消stderr处理任务时出错: {e}")

            # 清理资源
            self.process = None
            self.ws_server = None
            self.stderr_task = None
            self.running = False
            # 设置连接状态为未连接
            self.connection_status = self.ConnectionStatus.DISCONNECTED
            self.error_message = None

            # 释放WebSocket端口
            if self.ws_port is not None:
                try:
                    port_allocator.release_port(self.ws_port)
                    logging.info(f"已释放WebSocket端口: {self.ws_port}")
                except Exception as e:
                    logging.error(f"释放端口 {self.ws_port} 时出错: {e}")

    def is_running(self) -> bool:
        """检查服务是否运行中"""
        if not self.running:
            return False

        # 检查scrcpy进程是否运行中
        if not self.process or self.process.poll() is not None:
            return False

        # 检查WebSocket服务器是否运行中
        if not self.ws_server:
            return False

        return True


class ScrcpyServiceManager:
    """scrcpy服务管理器"""

    def __init__(self):
        self.services: Dict[str, ScrcpyService] = {}
        self.lock = asyncio.Lock()

    async def create_service(
        self, session_id: str, device_ip: str, device_port: int
    ) -> int:
        """创建并启动scrcpy服务"""
        async with self.lock:
            # 检查是否已有该会话的服务
            if session_id in self.services:
                service = self.services[session_id]
                if service.is_running():
                    logging.info(
                        f"会话 {session_id} 的scrcpy服务已在运行，端口: {service.ws_port}"
                    )
                    return service.ws_port
                else:
                    # 服务已停止，移除并重新创建
                    del self.services[session_id]

            # 创建新服务
            service = ScrcpyService(session_id, device_ip, device_port)
            ws_port = await service.start()
            self.services[session_id] = service

            logging.info(f"为会话 {session_id} 创建了新的scrcpy服务，端口: {ws_port}")
            return ws_port

    async def stop_service(self, session_id: str):
        """停止指定会话的scrcpy服务"""
        async with self.lock:
            if session_id in self.services:
                service = self.services[session_id]
                await service.stop()
                del self.services[session_id]
                logging.info(f"已停止并移除会话 {session_id} 的scrcpy服务")
            else:
                logging.warning(f"会话 {session_id} 的scrcpy服务不存在")

    async def get_service_port(self, session_id: str) -> Optional[int]:
        """获取指定会话的scrcpy服务端口"""
        async with self.lock:
            if session_id in self.services:
                service = self.services[session_id]
                if service.is_running():
                    return service.ws_port
        return None

    async def list_services(self) -> Dict[str, Dict[str, Any]]:
        """列出所有scrcpy服务及其状态"""
        async with self.lock:
            services_info = {}
            for session_id, service in self.services.items():
                services_info[session_id] = {
                    "device_ip": service.device_ip,
                    "device_port": service.device_port,
                    "ws_port": service.ws_port,
                    "running": service.is_running(),
                    "connection_status": service.connection_status,
                    "error_message": service.error_message,
                }
            return services_info

    async def get_service_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取指定会话的服务状态"""
        async with self.lock:
            if session_id in self.services:
                service = self.services[session_id]
                return {
                    "device_ip": service.device_ip,
                    "device_port": service.device_port,
                    "ws_port": service.ws_port,
                    "running": service.is_running(),
                    "connection_status": service.connection_status,
                    "error_message": service.error_message,
                }
        return None

    async def stop_all_services(self):
        """停止所有scrcpy服务"""
        async with self.lock:
            for session_id in list(self.services.keys()):
                service = self.services[session_id]
                await service.stop()
                del self.services[session_id]
                logging.info(f"已停止并移除会话 {session_id} 的scrcpy服务")

    async def cleanup_stopped_services(self):
        """清理已停止的服务"""
        async with self.lock:
            stopped_sessions = []
            for session_id, service in self.services.items():
                if not service.is_running():
                    stopped_sessions.append(session_id)

            for session_id in stopped_sessions:
                del self.services[session_id]
                logging.info(f"清理已停止的scrcpy服务: {session_id}")


# 全局服务管理器实例
scrcpy_service_manager = ScrcpyServiceManager()
