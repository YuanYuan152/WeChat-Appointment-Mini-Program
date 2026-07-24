from ensure_schema import ensure_tables

def init_db():
    ensure_tables()
    print("Application-managed tables created successfully.")

if __name__ == "__main__":
    init_db()
