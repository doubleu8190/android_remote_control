import asyncio
import logging
import subprocess
from typing import Dict
from typing import Any
from .fifo_allocator import fifo_allocator


class ScrcpyService:
    """单个scrcpy服务实例"""

    def __init__(self, device_ip: str, device_port: int):
        self.device_ip = device_ip
        self.device_port = device_port
        self.scrcpy_to_ffmpeg_fifo: str | None = None
        # scrcpy 输出的是编码后的视频流（H.264 in container），浏览器不能直接作为<img>播放
        # 这里通过ffmpeg将H.264编码的视频流转换为（逐帧 JPEG）后再通过 Websocket 推送。
        self.scrcpy_process: asyncio.subprocess.Process | None = None
        self.ffmpeg_process: asyncio.subprocess.Process | None = None

        self.running: bool = False
        # websocket 同一连接不允许并发 send；用锁统一串行化发送（视频帧/控制消息共用）
        self._send_locks: Dict[Any, asyncio.Lock] = {}
        self.scrcpy_stderr_task: asyncio.Task | None = None
        self.ffmpeg_stderr_task: asyncio.Task | None = None
        self.pump_task: asyncio.Task | None = None
        self.video_task: asyncio.Task | None = None

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

    async def handle_stderr(self, prefix: str, stream: asyncio.StreamReader | None):
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

    async def start(self) -> asyncio.StreamReader:
        """
        启动scrcpy服务并返回FFmpeg stdout FIFO路径
        srcpy(mkv/h264) -> scrcpy_to_ffmpeg_fifo -> ffmpeg_out_fifo(mjpeg)
        Returns:
            str: FFmpeg stdout FIFO路径的字符串
        """
        logging.info(f"准备启动scrcpy服务，设备: {self.device_ip}:{self.device_port}")
        # 分配命名管道
        self.scrcpy_to_ffmpeg_fifo = (
            f"/tmp/scrcpy_to_ffmpeg_{self.device_ip}_{self.device_port}"
        )
        await fifo_allocator.allocate_fifo(self.scrcpy_to_ffmpeg_fifo)

        # 连接ADB设备
        if not await self.adb_connect():
            logging.error("ADB连接失败，无法启动scrcpy服务")
            return None

        try:
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
                self.scrcpy_to_ffmpeg_fifo,
                "--record-format",
                "mkv",
                "-m",
                "800",
                "--max-fps",
                "30",
                "--video-bit-rate",
                "4M",
                "--video-codec",
                "h264",
                "--capture-orientation",
                "0",
            ]

            # 启动scrcpy进程
            self.scrcpy_process = await asyncio.create_subprocess_exec(
                *scrcpy_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # 检查子进程是否立即退出
            if self.scrcpy_process.returncode is not None:
                raise RuntimeError(
                    f"scrcpy进程启动失败，退出码: {self.scrcpy_process.returncode}"
                )

            # 启动stderr处理任务
            self.scrcpy_stderr_task = asyncio.create_task(
                self.handle_stderr("scrcpy_stderr", self.scrcpy_process.stderr)
            )

            logging.info(
                f"启动scrcpy进程，pid: {self.scrcpy_process.pid}，连接设备: {self.device_ip}:{self.device_port}"
            )

            # ffmpeg 转码为 MJPEG 前端用<img>逐帧刷新
            ffmpeg_cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "warning",
                "-i",
                self.scrcpy_to_ffmpeg_fifo,
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
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # 检查子进程是否立即退出
            if self.ffmpeg_process.returncode is not None:
                raise RuntimeError(
                    f"ffmpeg进程启动失败，退出码: {self.ffmpeg_process.returncode}"
                )

            self.ffmpeg_stderr_task = asyncio.create_task(
                self.handle_stderr("ffmpeg_stderr", self.ffmpeg_process.stderr)
            )

            logging.info(f"启动ffmpeg进程，pid: {self.ffmpeg_process.pid}，读取视频流管道: {self.scrcpy_to_ffmpeg_fifo}")

            self.running = True

            return self.ffmpeg_process.stdout
        except Exception as e:
            logging.error(f"启动scrcpy服务失败: {e}")

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
            # 释放命名管道
            fifo_allocator.release_fifo(self.scrcpy_to_ffmpeg_fifo)
            logging.info("scrcpy服务已停止")
            raise

    async def stop(self):
        """停止scrcpy服务并释放所有资源"""
        try:
            # 停止运行的服务
            if self.running:
                logging.info(
                    f"开始停止scrcpy服务 (PID: {self.scrcpy_process.pid if self.scrcpy_process else 'N/A'})"
                )

                tasks = [
                    self.video_task,
                    self.pump_task,
                    self.scrcpy_stderr_task,
                    self.ffmpeg_stderr_task,
                ]
                # 停止scrcpy进程，取消后台任务
                for task in tasks:
                    if task:
                        task.cancel()
                try:
                    await asyncio.gather(*tasks, return_exceptions=True)
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
                # 释放命名管道
                fifo_allocator.release_fifo(self.scrcpy_to_ffmpeg_fifo)
                logging.info("scrcpy服务已停止")

        except Exception as e:
            logging.error(f"停止scrcpy服务时发生异常: {e}")
            raise

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

        return True
