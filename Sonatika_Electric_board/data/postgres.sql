CREATE TABLE IF NOT EXISTS Consumers (
    C_ID SERIAL PRIMARY KEY,
    Customer_Name TEXT NOT NULL,
    Address varchar(100) NOT NULL,
    Phone varchar(10) NOT NULL,
    Meter_ID varchar(7) NOT NULL UNIQUE,
    Connection_Type TEXT NOT NULL DEFAULT 'Residential/குடியிருப்பு'
);

CREATE TABLE IF NOT EXISTS Meter_Readings (
    R_ID SERIAL PRIMARY KEY,
    C_ID INTEGER NOT NULL,
    R_Date DATE NOT NULL,
    Previous_Reading float NOT NULL,
    Units_Consumed float not null
);

CREATE TABLE IF NOT EXISTS Tariff (
    SLAB_ID SERIAL PRIMARY KEY,
    Connection_Type TEXT NOT NULL,
    Min_Units INTEGER NOT NULL,
    Max_Units INTEGER NOT NULL,
    Rate_Per_Unit decimal(5,2) NOT NULL,
    Fixed_Charge decimal(10,2) NOT NULL,
    Tax_Percent decimal(5,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS Bill (
    B_ID SERIAL PRIMARY KEY,
    C_ID INTEGER NOT NULL,
    Bill_Month TEXT NOT NULL,
    Previous_Reading float NOT NULL,
    Current_Reading float NOT NULL,
    Units_Consumed float not null,
    Rate_Per_Unit decimal(5,2) NOT NULL,
    Total_Amt decimal(10,2) NOT NULL,
    Status TEXT NOT NULL DEFAULT 'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்'
);


ALTER TABLE Bill ADD COLUMN IF NOT EXISTS Paid_At TEXT;
ALTER TABLE Bill ADD COLUMN IF NOT EXISTS Payment_Method TEXT;
ALTER TABLE Bill ADD COLUMN IF NOT EXISTS Transaction_ID TEXT;
CREATE INDEX IF NOT EXISTS Bill_Consumer ON Bill(C_ID, B_ID);
CREATE OR REPLACE VIEW Paid_Bills AS
SELECT * FROM Bill WHERE LOWER(TRIM(Status)) = 'paid' OR LOWER(TRIM(Status)) LIKE 'paid/%';
CREATE OR REPLACE VIEW Unpaid_Bills AS
SELECT * FROM Bill WHERE LOWER(TRIM(Status)) != 'paid' AND LOWER(TRIM(Status)) NOT LIKE 'paid/%';
INSERT INTO Tariff
    (Connection_Type, Min_Units, Max_Units, Rate_Per_Unit, Fixed_Charge, Tax_Percent)
SELECT * FROM (VALUES
    ('Residential', 0, 100, 2.50, 50.00, 5.00),
    ('Residential', 101, 300, 3.50, 75.00, 5.00),
    ('Residential', 301, 999999, 5.00, 100.00, 5.00),
    ('Commercial', 0, 300, 6.00, 150.00, 8.00),
    ('Commercial', 301, 999999, 7.50, 250.00, 8.00),
    ('Industrial', 0, 500, 8.00, 300.00, 10.00),
    ('Industrial', 501, 999999, 10.00, 500.00, 10.00),
    ('Agricultural', 0, 200, 4.00, 100.00, 6.00),
    ('Agricultural', 201, 999999, 5.50, 150.00, 6.00),
    ('Public Service', 0, 400, 3.00, 80.00, 4.00),
    ('Public Service', 401, 999999, 4.50, 120.00, 4.00)) AS defaults (Connection_Type, Min_Units, Max_Units, Rate_Per_Unit, Fixed_Charge, Tax_Percent) WHERE NOT EXISTS (SELECT 1 FROM Tariff);
