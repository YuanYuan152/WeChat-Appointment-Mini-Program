"""创建 AppOrder 表（如不存在）"""
import pyodbc

conn_str = "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\SQLEXPRESS;DATABASE=lxxlBuild;Trusted_Connection=yes;"
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

sql = """
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppOrder]') AND type = 'U')
BEGIN
CREATE TABLE [dbo].[AppOrder](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [AccountId] [int] NOT NULL,
    [SlotId] [int] NULL,
    [OutTradeNo] [nvarchar](64) NOT NULL,
    [TransactionId] [nvarchar](64) NULL,
    [TotalFee] [int] NOT NULL,
    [Status] [nvarchar](20) NOT NULL DEFAULT 'PENDING',
    [Description] [nvarchar](200) NULL,
    [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
    [PaidAt] [datetime] NULL,
    [UpdatedAt] [datetime] NULL,
    CONSTRAINT [PK_AppOrder] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_AppOrder_OutTradeNo] UNIQUE ([OutTradeNo])
)
END
"""
cursor.execute(sql)
conn.commit()
print("AppOrder table ready")
conn.close()
