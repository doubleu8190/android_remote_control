import os
import time
from langchain.vectorstores import VectorStore
from langchain.embeddings import BaseEmbeddings
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from typing import List, Dict, Any
from langchain.schema import Document


class ContextCompressionService:
    """
    上下文压缩服务，实现五步压缩策略
    """

    def __init__(self, vector_store: VectorStore,
                 embeddings: BaseEmbeddings, llm):
        self.vector_store = vector_store
        self.embeddings = embeddings
        self.llm = llm
        self.compressor = LLMChainExtractor.from_llm(llm)
        self.compression_retriever = ContextualCompressionRetriever(
            base_compressor=self.compressor,
            base_retriever=vector_store.as_retriever()
        )
        self.cache_dir = "./context_cache"
        os.makedirs(self.cache_dir, exist_ok=True)
        self.message_history = []

    def _save_to_disk(self, content: str) -> str:
        """
        将内容保存到磁盘并返回文件路径
        """
        file_name = f"{int(time.time())}_{hash(content)}.txt"
        file_path = os.path.join(self.cache_dir, file_name)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return file_path

    def _generate_summary(self, content: str) -> str:
        """
        生成内容摘要
        """
        prompt = f"请生成以下内容的2KB以内的摘要：\n{content[:10000]}"
        return self.llm(prompt)

    def _is_retrievable_tool(self, tool_name: str) -> bool:
        """
        判断工具是否可重新获取
        """
        retrievable_tools = ["Read", "Bash", "Search"]
        return tool_name in retrievable_tools

    def _calculate_token_count(self, text: str) -> int:
        """
        计算文本的Token数
        """
        # 简单估算，实际应用中可以使用更准确的方法
        return len(text) // 4

    def compress(self, query: str,
                 context: List[Dict[str, Any]], max_tokens: int = 1000) -> str:
        """
        压缩上下文
        """
        # 第一步：大结果存磁盘
        processed_context = []
        total_size = 0
        large_results = []

        for item in context:
            if isinstance(item, dict) and 'content' in item:
                content = item['content']
                content_size = len(content.encode('utf-8'))

                if content_size > 50 * 1024:  # 50KB
                    # 生成摘要并保存到磁盘
                    summary = self._generate_summary(content)
                    file_path = self._save_to_disk(content)
                    processed_item = {
                        **item,
                        'content': f"[磁盘存储] {summary}\n文件路径: {file_path}",
                        'is_disk_stored': True
                    }
                    processed_context.append(processed_item)
                    total_size += len(
                        processed_item['content'].encode('utf-8'))
                else:
                    processed_context.append(item)
                    total_size += content_size
                    if content_size > 10 * 1024:  # 10KB
                        large_results.append((content_size, item))

        # 检查总量是否超过200KB
        while total_size > 200 * 1024:
            if not large_results:
                break
            # 找出最大的结果
            large_results.sort(reverse=True, key=lambda x: x[0])
            largest_size, largest_item = large_results.pop(0)

            # 从处理后的上下文中移除
            for i, item in enumerate(processed_context):
                if item == largest_item:
                    # 生成摘要并保存到磁盘
                    summary = self._generate_summary(largest_item['content'])
                    file_path = self._save_to_disk(largest_item['content'])
                    processed_context[i] = {
                        **largest_item,
                        'content': f"[磁盘存储] {summary}\n文件路径: {file_path}",
                        'is_disk_stored': True
                    }
                    total_size -= largest_size
                    total_size += len(processed_context[i]
                                      ['content'].encode('utf-8'))
                    break

        # 第二步：砍掉远古消息
        current_time = time.time()
        recent_context = []
        snip_tokens_freed = 0

        for item in processed_context:
            if 'timestamp' in item:
                age = current_time - item['timestamp']
                if age < 3600:  # 1小时内的消息保留
                    recent_context.append(item)
                else:
                    snip_tokens_freed += self._calculate_token_count(
                        item['content'])
            else:
                recent_context.append(item)

        # 第三步：裁剪老的工具输出
        for item in recent_context:
            if 'tool_name' in item and self._is_retrievable_tool(
                    item['tool_name']):
                if 'timestamp' in item:
                    age = current_time - item['timestamp']
                    # 时间衰减， older than 30 minutes gets truncated
                    if age > 1800:
                        item['content'] = item['content'][:1000] + "... [已裁剪]"

        # 第四步：读时投影
        context_texts = [item['content'] for item in recent_context]
        compressed_context = "\n".join(context_texts)
        current_tokens = self._calculate_token_count(compressed_context)

        # 90% 上下文窗口：主动开始分段压缩
        if current_tokens > max_tokens * 0.9:
            # 保留最近的消息，压缩 older ones
            half = len(recent_context) // 2
            recent_texts = [item['content'] for item in recent_context[-half:]]
            compressed_context = "\n".join(recent_texts)

        # 95% 上下文窗口：紧急压缩更多内容
        if self._calculate_token_count(compressed_context) > max_tokens * 0.95:
            # 只保留最近的几条消息
            recent_texts = [item['content'] for item in recent_context[-3:]]
            compressed_context = "\n".join(recent_texts)

        # 第五步：全量摘要
        if self._calculate_token_count(compressed_context) > max_tokens:
            # 生成全量摘要
            summary_prompt = f"请将以下对话总结为一段结构化摘要：\n{compressed_context}"
            summary = self.llm(summary_prompt)

            # 替换为摘要
            compressed_context = f"[对话摘要]\n{summary}\n[压缩边界] 原始Token数: {current_tokens}"

        return compressed_context

    def add_context(self, context: List[Dict[str, Any]]) -> None:
        """
        添加上下文到消息历史
        """
        for item in context:
            if 'timestamp' not in item:
                item['timestamp'] = time.time()
            self.message_history.append(item)

        # 向量化存储
        documents = [Document(page_content=item['content'])
                     for item in context]
        self.vector_store.add_documents(documents)

    def clear_context(self) -> None:
        """
        清空上下文
        """
        self.message_history = []
        # 具体实现取决于使用的向量存储
        if hasattr(self.vector_store, 'delete'):
            self.vector_store.delete([])


# 示例使用
# from langchain.vectorstores import FAISS
# from langchain.embeddings import OpenAIEmbeddings
# from langchain.llms import OpenAI
#
# vector_store = FAISS.from_texts([""], OpenAIEmbeddings())
# compression_service = ContextCompressionService(
#     vector_store=vector_store,
#     embeddings=OpenAIEmbeddings(),
#     llm=OpenAI()
# )
#
# # 添加示例上下文
# context = [
#     {"content": "Hello, how are you?", "timestamp": time.time()},
#     {"content": "I'm fine, thank you!", "timestamp": time.time()},
#     {"content": "This is a very long tool output..." * 1000, "tool_name": "Read", "timestamp": time.time()}
# ]
# compression_service.add_context(context)
#
# # 压缩上下文
# compressed = compression_service.compress("What did we talk about?", context, max_tokens=1000)
# print(compressed)
