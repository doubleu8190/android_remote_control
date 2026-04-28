import logging
from typing import Dict
from sqlalchemy.orm import Session
from .sql_session_history import SQLAlchemyMessageHistory


class SessionHistoryManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'session_to_history'):
            self.session_to_history: Dict[str, SQLAlchemyMessageHistory] = {}

    def get_session_history(self, session_id: str) -> SQLAlchemyMessageHistory | None:
        return self.session_to_history[session_id]

    def create_session_history(
        self, session_id: str, db_session: Session
    ) -> SQLAlchemyMessageHistory:
        if session_id in self.session_to_history:
            return self.session_to_history[session_id]
        self.session_to_history[session_id] = SQLAlchemyMessageHistory(
            session_id=session_id, db_session=db_session
        )
        logging.info(f"Session history created for session_id: {session_id}")
        return self.session_to_history[session_id]

    def clear_session_history(self, session_id: str) -> None:
        logging.info(f"Clearing session history for session_id: {session_id}")
        self.session_to_history.pop(session_id, None)

    def clear_all_session_history(self) -> None:
        logging.info("Clearing all session histories")
        self.session_to_history.clear()

session_history_manager = SessionHistoryManager()