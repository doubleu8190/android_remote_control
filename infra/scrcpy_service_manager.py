import asyncio
import logging
from math import log
import subprocess  # nosec: B404 - subprocess用于启动外部进程，需要安全使用
import json
import websockets
from typing import Optional, Dict, Any, Set
from .port_allocator import port_allocator
import os


FIFO_PATH = "/tmp/scrcpy_fifo"


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
        # scrcpy 输出的是编码后的视频流（H.264 in container），浏览器不能直接作为<img>播放
        # 这里通过ffmpeg将H.264编码的视频流转换为（逐帧 JPEG）后再通过 Websocket 推送。
        self.scrcpy_process: asyncio.subprocess.Process | None = None
        self.ffmpeg_process: asyncio.subprocess.Process | None = None
        self.ws_port: int | None = None
        self.running: bool = False
        self.clients: Set[Any] = set()
        # websocket 同一连接不允许并发 send；用锁统一串行化发送（视频帧/控制消息共用）
        self._send_locks: Dict[Any, asyncio.Lock] = {}
        self.ws_server = None
        self.scrcpy_stderr_task: asyncio.Task | None = None
        self.ffmpeg_stderr_task: asyncio.Task | None = None
        self.pump_task: asyncio.Task | None = None
        self.video_task: asyncio.Task | None = None
        self.connection_status = self.ConnectionStatus.DISCONNECTED
        self.error_message: str | None = None

    def create_fifo(self):
        """创建命名管道（如果已存在则删除重建）"""
        if os.path.exists(FIFO_PATH):
            os.unlink(FIFO_PATH)
        os.mkfifo(FIFO_PATH)
        print(f"✅ 命名管道已创建: {FIFO_PATH}")

    async def _pipe_logger(self, prefix: str, stream: asyncio.StreamReader | None):
        """持续读取子进程 stderr 并打印日志（不阻塞主循环）"""
        if stream is None:
            return
        try:
            while True:
                line = await stream.readline()
                if not line:
                    break
                logging.warning(
                    f"{prefix}: {line.decode('utf-8', errors='ignore').strip()}"
                )
        except Exception as e:
            logging.error("读取 %s stderr 时出错： %s", prefix, e)

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
            logging.info(f"adb devices命令执行结果: {result.stdout}")
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

    async def _broadcast_binary(self, payload: bytes):
        """向所有客户端发送二进制数据；慢的客户端会被剔除，避免拖垮视频读取线程"""
        if not self.clients:
            return

        async def _safe_send(ws) -> bool:
            try:
                lock = self._send_locks.get(ws)
                if lock is None:
                    lock = asyncio.Lock()
                    self._send_locks[ws] = lock
                async with lock:
                    await asyncio.wait_for(ws.send(payload), timeout=0.5)
                return True
            except Exception as e:
                logging.error(f"_safe_send 异常: {e}")
                return False

        results = await asyncio.gather(
            *(_safe_send(ws) for ws in list(self.clients)), return_exceptions=True
        )
        # 清理发送失败的连接
        for ws, ok in zip(list(self.clients), results):
            if ok is not True:
                self.clients.discard(ws)
                self._send_locks.pop(ws, None)
                try:
                    await ws.close()
                except Exception as e:
                    logging.error(f"关闭客户端 {id(ws)} 连接时出错: {e}")

    async def _video_loop(self):
        """
        从 ffmpeg stdout 读取 MJPEG 字节流，按 JPEG 起止标记拆帧后广播。

        关键点：
        - 不能用 BufferedReader.read(4096) 这种“读满才返回”的 API，否则在数据不足时会表现为卡死；
        - asyncio 子进程的 StreamReader.read(n) 会在“有数据可读”时尽快返回(<=n), 不会强制等满 n 字节；
        """
        if self.ffmpeg_process is None or self.ffmpeg_process.stdout is None:
            logging.error("ffmpeg 进程未初始化, 无法启动视频读取循环")
            return

        buf = bytearray()
        max_buf = 8 * 1024 * 1024
        frame_count = 0

        try:
            logging.info("开始视频读取循环")
            while self.is_running():
                logging.debug("等待ffmpeg stdout 读取数据...")
                # 增加超时机制，避免无限阻塞
                try:
                    chunk = await asyncio.wait_for(
                        self.ffmpeg_process.stdout.read(4096), timeout=10.0
                    )
                except asyncio.TimeoutError:
                    logging.warning("ffmpeg stdout 读取超时，检查ffmpeg进程状态")
                    # 检查ffmpeg进程是否还在运行
                    if (
                        self.ffmpeg_process
                        and self.ffmpeg_process.returncode is not None
                    ):
                        logging.warning(
                            f"ffmpeg进程已退出，退出码: {self.ffmpeg_process.returncode}"
                        )
                        break
                    continue
                if not chunk:
                    logging.debug("ffmpeg stdout 读取到空数据，结束读取")
                    break
                logging.debug(f"ffmpeg stdout 读取 {len(chunk)} 字节")
                buf.extend(chunk)
                if len(buf) > max_buf:
                    logging.debug(f"视频缓冲区大小超过 {max_buf} 字节，开始丢弃旧数据")
                    # 丢弃旧数据，尝试从最近的 JPEG 头开始重新同步
                    start = buf.rfind(b"\xff\xd8")
                    if start == -1:
                        buf.clear()
                    else:
                        del buf[:start]

                while True:
                    start = buf.find(b"\xff\xd8")  # SOI
                    if start == -1:
                        # 保留末尾 1 字节，避免 SOI 被跨 chunk 拆开
                        if len(buf) > 1:
                            del buf[:-1]
                        break
                    end = buf.find(b"\xff\xd9", start + 2)  # EOI
                    if end == -1:
                        if start > 0:
                            del buf[:start]
                        break

                    frame = bytes(buf[start : end + 2])
                    del buf[: end + 2]
                    frame_count += 1
                    if frame_count % 10 == 0:  # 每10帧记录一次，避免日志过多
                        logging.debug(
                            f"处理第 {frame_count} 帧，帧大小: {len(frame)} 字节"
                        )
                    await self._broadcast_binary(frame)
            logging.info(f"视频读取循环结束，共处理 {frame_count} 帧")
        except asyncio.CancelledError:
            logging.info("视频读取线程被取消")
        except Exception as e:
            logging.error(f"视频读取/广播循环异常: {e}")

    async def handle_client(self, websocket):
        """处理WebSocket客户端连接"""
        client_id = id(websocket)
        logging.info(f"新的视频流客户端连接: {client_id}")

        # 添加客户端到集合
        self.clients.add(websocket)
        self._send_locks.setdefault(websocket, asyncio.Lock())

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
            # 不在每个客户端协程里读取视频流（会抢同一 stdout，且易出现阻塞）
            # 这里仅负责：接收可选应用层 ping 并保持连接。
            async for message in websocket:
                if isinstance(message, (bytes, bytearray)):
                    continue
                logging.info(f"收到客户端消息: {message}")
                try:
                    obj = json.loads(message)
                except Exception as e:
                    logging.error(f"客户端发送无效JSON: {e}")
                    obj = None
                if message == "ping" or (
                    isinstance(obj, dict) and obj.get("type") == "ping"
                ):
                    async with self._send_locks[websocket]:
                        await websocket.send(json.dumps({"type": "pong"}))

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
            self._send_locks.pop(websocket, None)
            logging.info(f"客户端连接关闭: {client_id}")

            # 如果没有客户端连接，考虑停止服务
            if len(self.clients) == 0:
                logging.info("无客户端连接，考虑停止scrcpy服务")
                # 这里可以添加自动停止服务的逻辑
                # await self.stop()

    async def start(self) -> int:
        """启动scrcpy服务并返回WebSocket端口"""
        logging.info(f"准备启动scrcpy服务，会话ID: {self.session_id}")
        # 确保端口在任何情况下都能被释放
        allocated_port = None

        try:
            self.create_fifo()
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
            # 不能使用 `-- record -` 会被scrcpy当作“文件名为`-`”写入磁盘，而不是写到 stdout
            scrcpy_cmd = [
                "scrcpy",
                "-s",
                f"{self.device_ip}:{self.device_port}",
                "--no-audio",
                "--no-playback",
                "--no-window",  # 确保不显示任何窗口
                "--no-control",
                "--record",
                FIFO_PATH,
                "--record-format",
                "mkv",
                "-m",
                "1440",
                "--max-fps",
                "30",
                "--video-bit-rate",
                "10M",
                "--video-codec",
                "h264",
                "--capture-orientation",
                "0",
            ]

            # 启动scrcpy进程, srcpy(mkv/h264) -> ffmpeg -> stdout(mjpeg)
            self.scrcpy_process = await asyncio.create_subprocess_exec(
                *scrcpy_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            logging.info(
                f"启动scrcpy服务，pid: {self.scrcpy_process.pid}，设备: {self.device_ip}:{self.device_port}"
            )

            # 启动stderr处理任务
            self.scrcpy_stderr_task = asyncio.create_task(
                self._pipe_logger("scrcpy_stderr", self.scrcpy_process.stderr)
            )

            # ffmpeg 转码为 MJPEG 前端用<img>逐帧刷新
            ffmpeg_cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "debug",
                "-i",
                FIFO_PATH,
                "-f",
                "image2pipe",
                "-vcodec",
                "mjpeg",
                "-q:v",
                "15",
                "-fflags",
                "nobuffer",
                "-flush_packets",
                "1",
                "pipe:1",
            ]
            self.ffmpeg_process = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            logging.info(
                f"启动ffmpeg服务，pid: {self.ffmpeg_process.pid}，设备: {self.device_ip}:{self.device_port}"
            )
            self.ffmpeg_stderr_task = asyncio.create_task(
                self._pipe_logger("ffmpeg_stderr", self.ffmpeg_process.stderr)
            )

            # 检查子进程是否立即退出
            await asyncio.sleep(5)  # 等待进程启动
            if self.scrcpy_process.returncode is not None:
                raise RuntimeError(
                    f"scrcpy进程启动失败，退出码: {self.scrcpy_process.returncode}"
                )
            if self.ffmpeg_process.returncode is not None:
                raise RuntimeError(
                    f"ffmpeg进程启动失败，退出码: {self.ffmpeg_process.returncode}"
                )
            logging.info("scrcpy和ffmpeg进程启动正常")

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

            self.connection_status = self.ConnectionStatus.CONNECTED
            logging.info(f"scrcpy服务已启动 (PID: {self.scrcpy_process.pid})")
            logging.info(f"WebSocket服务器已启动，监听端口: {self.ws_port}")

            # 启动视频读取与广播任务（单一读取，避免 stdout 竞争/阻塞）
            self.video_task = asyncio.create_task(self._video_loop())
            self.running = True

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
            # 清理任务/进程
            for task in [
                self.video_task,
                self.pump_task,
                self.scrcpy_stderr_task,
                self.ffmpeg_stderr_task,
            ]:
                if task:
                    task.cancel()
            for task in [
                self.video_task,
                self.pump_task,
                self.scrcpy_stderr_task,
                self.ffmpeg_stderr_task,
            ]:
                if task:
                    try:
                        await asyncio.gather(task, return_exceptions=True)
                    except Exception as task_error:
                        logging.error(f"取消任务时出错: {task_error}")
            for proc in [self.scrcpy_process, self.ffmpeg_process]:
                if proc and proc.returncode is None:
                    try:
                        proc.terminate()
                        await asyncio.wait_for(proc.wait(), timeout=5)
                    except Exception as proc_error:
                        try:
                            logging.error(
                                f"终止进程时出错:{proc_error}, 强制终止: {proc.pid}"
                            )
                            proc.kill()
                        except Exception as e:
                            logging.error(f"强制终止进程时出错: {e}")

            # 重置状态
            self.scrcpy_process = None
            self.ffmpeg_process = None
            self.ws_server = None
            self.scrcpy_stderr_task = None
            self.ffmpeg_stderr_task = None
            self.pump_task = None
            self.video_task = None
            self.ws_port = None
            self.running = False
            raise

    async def stop(self):
        """停止scrcpy服务"""
        if self.running:
            logging.info(
                f"停止ffmpeg服务 (PID: {self.scrcpy_process.pid if self.ffmpeg_process else 'N/A'})"
            )

            # 关闭WebSocket服务器
            if self.ws_server:
                try:
                    self.ws_server.close()
                    await self.ws_server.wait_closed()
                    logging.info("WebSocket服务器已关闭")
                except Exception as e:
                    logging.error(f"关闭WebSocket服务器时出错: {e}")

            # 停止scrcpy进程，取消后台任务
            for task in [
                self.video_task,
                self.pump_task,
                self.scrcpy_stderr_task,
                self.ffmpeg_stderr_task,
            ]:
                if task:
                    task.cancel()
            for task in [
                self.video_task,
                self.pump_task,
                self.scrcpy_stderr_task,
                self.ffmpeg_stderr_task,
            ]:
                if task:
                    try:
                        await asyncio.gather(task, return_exceptions=True)
                    except Exception as task_error:
                        logging.error(f"取消任务时出错: {task_error}")

            # 停止子进程（先终止ffmpeg，再终止scrcpy）
            for proc, name in [
                (self.ffmpeg_process, "ffmpeg"),
                (self.scrcpy_process, "scrcpy"),
            ]:
                if proc and proc.returncode is None:
                    try:
                        proc.terminate()
                        await asyncio.wait_for(proc.wait(), timeout=5)
                    except Exception as proc_error:
                        try:
                            logging.error(
                                f"终止进程时出错:{proc_error}, 强制终止: {name}({proc.pid})"
                            )
                            proc.kill()
                        except Exception as e:
                            logging.error(f"强制终止进程时出错: {e}")

            # 清理资源
            self.scrcpy_process = None
            self.ffmpeg_process = None
            self.ws_server = None
            self.scrcpy_stderr_task = None
            self.ffmpeg_stderr_task = None
            self.pump_task = None
            self.video_task = None
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
            logging.info("服务未运行")
            return False

        # 检查scrcpy/ffmpeg进程是否运行中
        if not self.scrcpy_process or self.scrcpy_process.returncode is not None:
            logging.info("scrcpy进程已退出")
            return False
        if not self.ffmpeg_process or self.ffmpeg_process.returncode is not None:
            logging.info("ffmpeg进程已退出")
            return False

        # 检查WebSocket服务器是否运行中
        if not self.ws_server:
            logging.info("WebSocket服务器未运行")
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
                logging.info(f"发现会话{session_id}已存在，检查会话的scrcpy服务状态")
                if service.is_running():
                    logging.info(
                        f"会话 {session_id} 的scrcpy服务已在运行，端口: {service.ws_port}"
                    )
                    assert service.ws_port is not None, "scrcpy服务端口未分配"
                    return service.ws_port
                else:
                    logging.info(
                        f"会话 {session_id} 的scrcpy服务已停止，移除并重新创建"
                    )
                    # 服务已停止，移除并重新创建
                    del self.services[session_id]

            # 创建新服务
            logging.info(f"准备创建新的scrcpy服务，会话ID: {session_id}")
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
