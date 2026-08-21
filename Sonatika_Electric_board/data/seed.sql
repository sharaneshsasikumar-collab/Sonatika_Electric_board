INSERT INTO Consumers
    (Customer_Name, Address, Phone, Meter_ID, Connection_Type)
VALUES
    ('Meera Krishnan', 'Sonatika East', '9876543210', 'RES1001', 'Residential'),
    ('Anand Stores', 'South Bazaar', '7766554433', 'COM2001', 'Commercial');

INSERT INTO Tariff
    (Connection_Type, Min_Units, Max_Units, Rate_Per_Unit, Fixed_Charge, Tax_Percent)
VALUES
    ('Residential', 0, 100, 2.50, 50.00, 5.00),
    ('Residential', 101, 300, 3.50, 75.00, 5.00),
    ('Residential', 301, 999999, 5.00, 100.00, 5.00),
    ('Commercial', 0, 300, 6.00, 150.00, 8.00),
    ('Commercial', 301, 999999, 7.50, 250.00, 8.00);

INSERT INTO Bill
    (C_ID, Bill_Month, Previous_Reading, Current_Reading,
     Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
VALUES
    (1, 'August 2026', 1000.00, 1120.00, 120.00, 3.50, 519.75, 'if the bill is not paid then you connection will be disconnected/உங்கள் பில் செலுத்தப்படாவிட்டால் உங்கள் இணைப்பு துண்டிக்கப்படும்');
