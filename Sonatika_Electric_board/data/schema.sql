CREATE TABLE IF NOT EXISTS Consumers (
    C_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Customer_Name TEXT NOT NULL,
    Address varchar(100) NOT NULL,
    Phone varchar(10) NOT NULL,
    Meter_ID varchar(7) NOT NULL UNIQUE,
    Connection_Type TEXT NOT NULL DEFAULT 'Residential/குடியிருப்பு'
);

CREATE TABLE IF NOT EXISTS Meter_Readings (
    R_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    C_ID varchar(7) NOT NULL,
    R_Date DATE NOT NULL,
    Previous_Reading float NOT NULL,
    Units_Consumed float not null,
    FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);

CREATE TABLE IF NOT EXISTS Tariff (
    SLAB_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Connection_Type varchar(10) NOT NULL,
    Min_Units INTEGER NOT NULL,
    Max_Units INTEGER NOT NULL,
    Rate_Per_Unit decimal(5,2) NOT NULL,
    Fixed_Charge decimal(10,2) NOT NULL,
    Tax_Percent decimal(5,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS Bill (
    B_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    C_ID varchar(7)NOT NULL,
    Bill_Month integer NOT NULL,
    Previous_Reading float NOT NULL,
    Current_Reading float NOT NULL,
    Units_Consumed float not null,
    Rate_Per_Unit decimal(5,2) NOT NULL,
    Total_Amt decimal(10,2) NOT NULL,
    Status TEXT NOT NULL DEFAULT 'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்',
    FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);
