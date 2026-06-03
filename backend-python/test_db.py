from database import engine

def test_connection():
    try:
        with engine.connect() as connection:
            print("Successfully connected to the database!")
    except Exception as e:
        print(f"Error connecting to the database: {e}")

if __name__ == "__main__":
    test_connection()
