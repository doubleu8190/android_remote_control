import asyncio
import logging
import os


class FifoAllocator:
    """命名管道分配器，确保每个session有独立的管道资源"""

    _instance = None
    _lock = asyncio.Lock()

    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super(FifoAllocator, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """初始化管道分配器"""
        if self._initialized:
            return
        self._allocator_lock = asyncio.Lock()
        self._initialized = True
        logging.info("FifoAllocator 初始化完成")

    async def allocate_fifo(self, fifo_path: str) -> str:
        """为指定路径分配一个独立的命名管道

        Args:
            fifo_path: 管道路径

        Returns:
            分配的管道路径

        Raises:
            RuntimeError: 如果路径已分配管道或分配失败
        """
        async with self._allocator_lock:
            # 生成唯一的管道路径

            # 创建物理管道文件
            try:
                # 如果管道已存在，先跳过
                if os.path.exists(fifo_path):
                    logging.info(f"管道文件{fifo_path}已存在，跳过创建")
                    return fifo_path

                # 创建新的命名管道
                os.mkfifo(fifo_path)
                logging.info(f"✅ 命名管道已创建: {fifo_path}")
            except Exception as e:
                logging.error(f"创建命名管道 {fifo_path} 时出错: {e}")
                raise RuntimeError(f"创建命名管道 {fifo_path} 时出错: {e}")

            return fifo_path

    async def release_fifo(self, fifo_path: str):
        """释放指定路径占用的管道资源

        Args:
            fifo_path: 管道路径

        Raises:
            RuntimeError: 如果路径未分配管道
        """
        async with self._allocator_lock:

            # 清理物理管道文件
            try:
                if os.path.exists(fifo_path):
                    os.unlink(fifo_path)
                    logging.info(f"删除管道文件: {fifo_path}")
            except Exception as e:
                logging.error(f"删除管道文件 {fifo_path} 时出错: {e}")
                raise RuntimeError(f"删除管道文件 {fifo_path} 时出错: {e}")

            logging.info(f"释放管道资源: {fifo_path}")


# 全局管道分配器实例
fifo_allocator = FifoAllocator()
