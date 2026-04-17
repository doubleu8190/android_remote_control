import os
import yaml
from typing import Dict, Any, Optional

class ConfigLoader:
    """配置加载器，用于从 YAML 文件加载配置"""
    
    _instance: Optional['ConfigLoader'] = None
    _config: Optional[Dict[str, Any]] = None
    
    @classmethod
    def get_instance(cls) -> 'ConfigLoader':
        """获取配置加载器单例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def __init__(self):
        """初始化配置加载器"""
        self.config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'engine_config.yaml')
        self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self._config = yaml.safe_load(f)
            # 解析环境变量
            self._resolve_env_variables(self._config)
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            self._config = {}
    
    def _resolve_env_variables(self, config: Dict[str, Any]):
        """解析配置中的环境变量"""
        for key, value in config.items():
            if isinstance(value, str) and value.startswith('${') and value.endswith('}'):
                env_var = value[2:-1]
                config[key] = os.getenv(env_var, value)
            elif isinstance(value, dict):
                self._resolve_env_variables(value)
    
    def get_config(self, key: str = None, default: Any = None) -> Any:
        """获取配置值
        
        Args:
            key: 配置键，支持点号分隔的路径，如 "llm.openai.model_name"
            default: 默认值
            
        Returns:
            配置值或默认值
        """
        if self._config is None:
            return default
        
        if key is None:
            return self._config
        
        # 解析点号分隔的路径
        keys = key.split('.')
        value = self._config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def reload_config(self):
        """重新加载配置文件"""
        self._load_config()

# 全局配置实例
config = ConfigLoader.get_instance()
