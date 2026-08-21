CREATE TABLE IF NOT EXISTS Consumers (
    C_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Customer_Name TEXT NOT NULL,
    Address TEXT NOT NULL,
    Phone TEXT,
    Meter_ID TEXT NOT NULL UNIQUE,
    Connection_Type TEXT NOT NULL DEFAULT 'Residential'
);

CREATE TABLE IF NOT EXISTS Meter_Readings (
    R_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    C_ID INTEGER NOT NULL,
    R_Date DATE NOT NULL,
    Current_Reading REAL NOT NULL,
    Previous_Reading REAL NOT NULL,
    Units_Consumed REAL NOT NULL,
    FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);

CREATE TABLE IF NOT EXISTS Tariff (
    SLAB_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Connection_Type TEXT NOT NULL,
    Min_Units INTEGER NOT NULL,
    Max_Units INTEGER NOT NULL,
    Rate_Per_Unit REAL NOT NULL,
    Fixed_Charge REAL NOT NULL,
    Tax_Percent REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS Bill (
    B_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    C_ID INTEGER NOT NULL,
    Bill_Month TEXT NOT NULL,
    Previous_Reading REAL NOT NULL,
    Current_Reading REAL NOT NULL,
    Units_Consumed REAL NOT NULL,
    Rate_Per_Unit REAL NOT NULL,
    Total_Amt REAL NOT NULL,
    Status TEXT NOT NULL DEFAULT 'Not Paid Bill Please pay ,then connection will be disconnected.| கட்டணம் செலுத்தப்படவில்லை; தயவுசெய்து செலுத்தவும், இல்லையெனில் இணைப்பு துண்டிக்கப்படும்.',
    FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);
