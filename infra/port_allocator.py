import os
import socket
import threading
import time
import json
import fcntl
import errno
from pathlib import Path
from typing import Optional, Set, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class PortAllocator:
    """端口分配器，支持跨进程的端口分配和跟踪"""
    
    # 默认配置
    DEFAULT_BASE_PORT = 8190
    DEFAULT_PORT_RANGE = 100
    DEFAULT_MAX_RETRIES = 50  # 增加重试次数以支持更多并发会话
    DEFAULT_STATE_DIR = "/tmp/scrcpy_ports"
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """单例模式"""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(PortAllocator, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        """初始化端口分配器"""
        if self._initialized:
            return
            
        self.base_port = int(os.getenv("SCRCPY_WS_PORT_BASE", self.DEFAULT_BASE_PORT))
        self.port_range = int(os.getenv("SCRCPY_WS_PORT_RANGE", self.DEFAULT_PORT_RANGE))
        self.max_retries = int(os.getenv("SCRCPY_WS_MAX_RETRIES", self.DEFAULT_MAX_RETRIES))
        
        # 状态目录用于跨进程同步
        self.state_dir = Path(os.getenv("SCRCPY_PORT_STATE_DIR", self.DEFAULT_STATE_DIR))
        self.state_dir.mkdir(parents=True, exist_ok=True)
        
        # 状态文件路径
        self.state_file = self.state_dir / "allocated_ports.json"
        self.state_lock_file = self.state_dir / "state.lock"
        
        # 进程内缓存
        self._allocated_ports: Set[int] = set()
        self._port_locks: Dict[int, threading.Lock] = {}
        self._port_sockets: Dict[int, socket.socket] = {}
        
        # 初始化状态文件
        self._init_state_file()
        
        self._initialized = True
        logger.info(f"PortAllocator 初始化完成，端口范围: {self.base_port}-{self.base_port + self.port_range - 1}")
    
    def _init_state_file(self):
        """初始化状态文件"""
        if not self.state_file.exists():
            with self._state_file_lock():
                with open(self.state_file, 'w') as f:
                    json.dump({}, f)
    
    def _state_file_lock(self):
        """获取状态文件的文件锁（跨进程同步）"""
        class FileLock:
            def __init__(self, state_lock_file):
                self.state_lock_file = state_lock_file
            
            def __enter__(self):
                self.fd = open(self.state_lock_file, 'w')
                # 获取独占锁
                fcntl.flock(self.fd, fcntl.LOCK_EX)
                return self.fd
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                fcntl.flock(self.fd, fcntl.LOCK_UN)
                self.fd.close()
        
        return FileLock(self.state_lock_file)
    
    def _read_state(self) -> Dict:
        """读取状态文件"""
        with self._state_file_lock():
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                return {}
    
    def _write_state(self, state: Dict):
        """写入状态文件"""
        with self._state_file_lock():
            with open(self.state_file, 'w') as f:
                json.dump(state, f)
    
    def _is_port_available_local(self, port: int) -> bool:
        """本地检查端口是否可用（不依赖状态文件）"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(('', port))
                return True
        except OSError:
            return False
    
    def _try_bind_port(self, port: int) -> Optional[socket.socket]:
        """尝试绑定端口，如果成功返回socket对象"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('', port))
            return s
        except OSError:
            return None
    
    def allocate_port(self, session_id: Optional[str] = None, preferred_port: Optional[int] = None) -> Optional[int]:
        """分配一个可用端口
        
        Args:
            session_id: 会话ID，用于跟踪端口分配
            preferred_port: 优先尝试的端口
            
        Returns:
            分配的端口号，如果分配失败则返回None
        """
        if preferred_port is not None:
            # 检查首选端口是否可用
            port = preferred_port
            if self._check_and_reserve_port(port, session_id):
                logger.info(f"成功分配首选端口: {port}")
                return port
        
        # 从基础端口开始搜索可用端口
        for offset in range(self.max_retries):
            port = self.base_port + offset
            
            # 检查端口是否在范围内
            if port >= self.base_port + self.port_range:
                break
            
            if self._check_and_reserve_port(port, session_id):
                logger.info(f"成功分配端口: {port} (尝试 {offset + 1}/{self.max_retries})")
                return port
        
        # 如果在基础范围内未找到，尝试随机端口
        logger.warning(f"在基础范围内未找到可用端口，尝试扩展搜索")
        for attempt in range(self.max_retries):
            # 尝试随机端口（在基础端口附近）
            import random
            port = self.base_port + random.randint(0, self.port_range * 2)
            
            if self._check_and_reserve_port(port, session_id):
                logger.info(f"成功分配扩展端口: {port}")
                return port
        
        logger.error(f"无法分配端口，已达到最大重试次数: {self.max_retries}")
        return None
    
    def _check_and_reserve_port(self, port: int, session_id: Optional[str]) -> bool:
        """检查并预留端口（原子操作）
        
        1. 检查端口是否已在状态文件中被分配
        2. 尝试实际绑定端口
        3. 如果绑定成功，更新状态文件
        """
        # 步骤1: 检查状态文件
        state = self._read_state()
        if str(port) in state:
            # 端口已被分配，检查是否仍然被占用
            port_info = state[str(port)]
            if self._is_port_actually_used(port, port_info):
                return False
            else:
                # 端口已分配但未被占用，清理旧记录
                logger.warning(f"端口 {port} 有旧分配记录但未被占用，进行清理")
                del state[str(port)]
                self._write_state(state)
        
        # 步骤2: 尝试绑定端口
        sock = self._try_bind_port(port)
        if sock is None:
            return False
        
        # 步骤3: 更新状态文件
        try:
            state[str(port)] = {
                "session_id": session_id,
                "pid": os.getpid(),
                "timestamp": time.time(),
                "host": socket.gethostname()
            }
            self._write_state(state)
            
            # 关闭socket，允许其他进程（当前进程）绑定该端口
            # 状态文件已记录分配，防止其他进程分配同一端口
            sock.close()
            return True
        except Exception as e:
            logger.error(f"更新端口状态失败: {e}")
            sock.close()
            return False
    
    def _is_port_actually_used(self, port: int, port_info: Dict) -> bool:
        """检查端口是否实际被占用
        
        通过尝试连接来检查端口是否实际在被使用
        """
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                result = s.connect_ex(('localhost', port))
                return result == 0  # 0表示连接成功，端口正在被监听
        except:
            return False
    
    def release_port(self, port: int):
        """释放端口
        
        Args:
            port: 要释放的端口号
        """
        # 关闭保持的socket
        if hasattr(self, '_port_sockets') and port in self._port_sockets:
            sock = self._port_sockets.pop(port)
            try:
                sock.close()
            except:
                pass
        
        # 从状态文件中移除
        state = self._read_state()
        if str(port) in state:
            del state[str(port)]
            self._write_state(state)
            logger.info(f"端口 {port} 已释放")
        else:
            logger.warning(f"尝试释放未分配的端口: {port}")
    
    def release_all_ports_by_session(self, session_id: str):
        """释放指定会话分配的所有端口"""
        state = self._read_state()
        ports_to_release = []
        
        for port_str, port_info in state.items():
            if port_info.get("session_id") == session_id:
                ports_to_release.append(int(port_str))
        
        for port in ports_to_release:
            self.release_port(port)
        
        if ports_to_release:
            logger.info(f"已释放会话 {session_id} 的 {len(ports_to_release)} 个端口")
    
    def cleanup_stale_ports(self, max_age_seconds: int = 3600):
        """清理过时的端口分配记录
        
        Args:
            max_age_seconds: 最大年龄（秒），超过此时间的记录将被清理
        """
        state = self._read_state()
        current_time = time.time()
        stale_ports = []
        
        for port_str, port_info in state.items():
            timestamp = port_info.get("timestamp", 0)
            if current_time - timestamp > max_age_seconds:
                # 检查端口是否实际仍在使用
                if not self._is_port_actually_used(int(port_str), port_info):
                    stale_ports.append(port_str)
        
        if stale_ports:
            for port_str in stale_ports:
                del state[port_str]
                logger.info(f"清理过时端口: {port_str}")
            self._write_state(state)
    
    def get_allocated_ports(self) -> Dict[int, Dict]:
        """获取所有已分配的端口信息"""
        state = self._read_state()
        return {int(port): info for port, info in state.items()}
    
    def is_port_allocated(self, port: int) -> bool:
        """检查端口是否已分配"""
        state = self._read_state()
        return str(port) in state
    
    def get_available_port_count(self) -> int:
        """获取可用端口数量估计"""
        state = self._read_state()
        allocated_count = len(state)
        return max(0, self.port_range - allocated_count)


# 全局实例
port_allocator = PortAllocator()