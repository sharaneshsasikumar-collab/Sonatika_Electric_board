USE Sonatika_Electricity_Board;

INSERT INTO Consumers (C_ID, Customer_Name, Address, Place, Phone, Meter_ID, Connection_Type) VALUES
(1, 'Chandran Mahadevan', '#20, Lodha Aqua, Zone 1, Janakapurana', 'Edorala City', '1789456897', 'AAAA0000', 'Residential'),
(2, 'Meera Krishnan', '14 Lake View Street', 'Sonatika East', '9876543210', 'RES1045', 'Residential'),
(3, 'Green Forge Works', 'Industrial Plot 42', 'North Grid Park', '8123456780', 'IND2201', 'Industrial'),
(4, 'City Street Light Wing', 'Ward Office 8', 'Central Circle', '9000011122', 'PUB7781', 'Street Light'),
(5, 'Anand Textiles', 'Market Road 6', 'South Bazaar', '7766554433', 'COM6190', 'Commercial'),
(6, 'Rural Pump House', 'Canal Road, Sector 3', 'Govt Pump Zone', '8899001122', 'AGR9088', 'Agriculture');

INSERT INTO Meter_Readings (R_ID, C_ID, R_Date, Current_Reading, P_Reading, Units_Consumed) VALUES
(1, 1, '2026-01-01', 18750.00, 17777.56, 972.44),
(2, 2, '2026-08-01', 10340.00, 10122.00, 218.00),
(3, 3, '2026-08-01', 88420.00, 84600.00, 3820.00),
(4, 4, '2026-08-01', 49210.00, 48110.00, 1100.00),
(5, 5, '2026-08-01', 23450.00, 22670.00, 780.00),
(6, 6, '2026-08-01', 12800.00, 12100.00, 700.00);

INSERT INTO Tariff (SLAB_ID, Connection_Type, Min_Units, Max_Units, Rate_Per_Unit, Fixed_Charge, Tax_Percent) VALUES
(1, 'Residential', 0, 100, 2.20, 80.00, 5.00),
(2, 'Residential', 101, 300, 3.80, 120.00, 5.00),
(3, 'Residential', 301, 999999, 5.60, 180.00, 5.00),
(4, 'Commercial', 0, 250, 6.00, 350.00, 8.00),
(5, 'Commercial', 251, 999999, 7.40, 500.00, 8.00),
(6, 'Industrial', 0, 1000, 7.80, 1200.00, 10.00),
(7, 'Industrial', 1001, 999999, 8.90, 1800.00, 10.00),
(8, 'Street Light', 0, 999999, 4.20, 250.00, 4.00),
(9, 'Public App', 0, 999999, 3.75, 200.00, 4.00),
(10, 'Agriculture', 0, 999999, 1.50, 60.00, 2.00),
(11, 'Power Plant', 0, 999999, 6.50, 1500.00, 12.00);

INSERT INTO Bill (B_ID, C_ID, Bill_Month, Units_Consumed, Energy_Charge, Fixed_Charge, Tax, Total_Amt, Bill_Date, Due_Date, Status) VALUES
(1, 1, 'January 2026', 972.44, 5445.66, 180.00, 281.28, 5906.95, '2026-01-02', '2026-01-17', 'Overdue'),
(2, 2, 'August 2026', 218.00, 828.40, 120.00, 47.42, 995.82, '2026-08-02', '2026-08-22', 'Due'),
(3, 3, 'August 2026', 3820.00, 33998.00, 1800.00, 3579.80, 39377.80, '2026-08-02', '2026-08-22', 'Due'),
(4, 4, 'August 2026', 1100.00, 4620.00, 250.00, 194.80, 5064.80, '2026-08-02', '2026-08-22', 'Paid'),
(5, 5, 'August 2026', 780.00, 5772.00, 500.00, 501.76, 6773.76, '2026-08-02', '2026-08-22', 'Due'),
(6, 6, 'August 2026', 700.00, 1050.00, 60.00, 22.20, 1132.20, '2026-08-02', '2026-08-22', 'Paid');

INSERT INTO Connection_Requests (Request_ID, Applicant_Name, Place, Address, Phone, Connection_Type, Load_KW, Status, Created_At) VALUES
(1, 'Nila Apartments', 'Sonatika West', 'Plot 9, New Housing Block', '9988776655', 'Residential', 18.50, 'Field Review', '2026-08-12'),
(2, 'Metro Charging Point', 'Central Circle', 'Bus Depot Yard', '8877665544', 'Public App', 45.00, 'Submitted', '2026-08-18');

INSERT INTO Feedback (Feedback_ID, C_ID, Place, Message, Created_At) VALUES
(1, 2, 'Sonatika East', 'Bill page is clear and easy to verify', '2026-08-15'),
(2, 5, 'South Bazaar', 'Need faster support for load upgrade', '2026-08-18');
