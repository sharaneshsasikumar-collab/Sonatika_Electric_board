INSERT INTO Consumers
    (C_ID, Customer_Name, Address, Phone, Meter_ID, Connection_Type)
VALUES
    (00000000, 'Meera Krishnan', 'Sonatika East', '9876543210', 'RES1001', 'Residential'),
    (00000001, 'Anand Stores', 'South Bazaar', '7766554433', 'COM2001', 'Commercial'),
    (00000002, 'Ramesh Kumar', 'Green Park', '9988776655', 'RES1002', 'Residential'),
    (00000003, 'Tech Solutions', 'Business District', '8877665544', 'COM2002', 'Commercial'),
    (00000004, 'Priya Sharma', 'Sunset Boulevard', '6655443322', 'RES1003', 'Residential'),
    (00000005, 'Global Enterprises', 'Industrial Area', '5544332211', 'COM2003', 'Commercial'),
    (00000006, 'Vikram Singh', 'Lakeview Avenue', '4433221100', 'RES1004', 'Residential'),
    (00000007, 'City Mart', 'Downtown Street', '3322110099', 'COM2004', 'Commercial'),
    (00000008, 'Anjali Reddy', 'Hilltop Lane', '2211009988', 'RES1005', 'Residential'),
    (00000009, 'Sunshine Cafe', 'Market Square', '1100998877', 'COM2005', 'Commercial');

INSERT INTO Tariff
    (Connection_Type, Min_Units, Max_Units, Rate_Per_Unit, Fixed_Charge, Tax_Percent)
VALUES
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
    ('Public Service', 401, 999999, 4.50, 120.00, 4.00);

INSERT INTO Bill
    (C_ID, Bill_Month, Previous_Reading, Current_Reading,
     Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
VALUES
    (0000001,'August2026',1000.00,900.00,100.00,3.50,519.00,'paid/செலுத்தப்பட்டது'),
    (0000002, 'August 2026', 500.00, 650.00, 150.00, 6.00, 930.00, 'paid/செலுத்தப்பட்டது'),
    (0000003, 'August 2026', 2₀₀₀.₀₀, 215₀.₀₀, 15₀.₀₀, 3.5₀, 519.75, 'paid/செலுத்தப்பட்டது'),
    (0000004, 'August 2026', 800.00, 950.00, 150.00, 6.00, 930.00, 'paid/செலுத்தப்பட்டது'),
    (0000005, 'August 2026', 1200.00, 1350.00, 150.00, 3.50, 519.75, 'paid/செலுத்தப்பட்டது'),
    (0000006, 'August 2026', 400.00, 550.00, 150.00, 6.00, 930.00, 'paid/செலுத்தப்பட்டது'),
    (0000007, 'August 2026', 1500.00, 1650.00, 150.00, 3.50, 519.75, 'paid/செலுத்தப்பட்டது'),
    (0000008, 'August 2026', 600.00, 750.00, 150.00, 6.00, 930.00, 'paid/செலுத்தப்பட்டது'),
    (0000009, 'August 2026', 1800.00, 1950.00, 150.00, 3.50, 519.75,'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்'),
    (0000010, 'August 2026', 1000.00, 1150.00, 150.00, 6.00, 930.00, 'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்');

insert into Meter_Readings
    (C_ID, R_Date, Previous_Reading, Units_Consumed)
values
    (0000001, '2026-08-01', 1000.00, 120.00),
    (0000002, '2026-08-01', 500.00, 150.00),
    (0000003, '2026-08-01', 2000.00, 150.00),
    (0000004, '2026-08-01', 800.00, 150.00),
    (0000005, '2026-08-01', 1200.00, 150.00),
    (0000006, '2026-08-01', 400.00, 150.00),
    (0000007, '2026-08-01', 1500.00, 150.00),
    (0000008, '2026-08-01', 600.00, 150.00),
    (0000009, '2026-08-01', 1800.00, 150.00);