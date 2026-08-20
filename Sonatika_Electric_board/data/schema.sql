CREATE DATABASE IF NOT EXISTS Sonatika_Electricity_Board;

USE Sonatika_Electricity_Board;

CREATE TABLE Consumers (
    C_ID INT PRIMARY KEY,
    Customer_Name VARCHAR(50) NOT NULL,
    Address VARCHAR(100),
    Place VARCHAR(60),
    Phone VARCHAR(15),
    Meter_ID VARCHAR(20) UNIQUE,
    Connection_Type VARCHAR(30) DEFAULT 'Residential'
);

CREATE TABLE Meter_Readings (
    R_ID INT PRIMARY KEY,
    C_ID INT NOT NULL,
    R_Date DATE NOT NULL,
    Current_Reading DECIMAL(10,2),
    P_Reading DECIMAL(10,2),
    Units_Consumed DECIMAL(10,2),
    CONSTRAINT FK_MeterReadings_Consumers
        FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);

CREATE TABLE Tariff (
    SLAB_ID INT PRIMARY KEY,
    Connection_Type VARCHAR(30) NOT NULL,
    Min_Units INT NOT NULL,
    Max_Units INT NOT NULL,
    Rate_Per_Unit DECIMAL(5,2) NOT NULL,
    Fixed_Charge DECIMAL(10,2) NOT NULL,
    Tax_Percent DECIMAL(5,2) NOT NULL
);

CREATE TABLE Bill (
    B_ID INT PRIMARY KEY,
    C_ID INT NOT NULL,
    Bill_Month VARCHAR(20),
    Units_Consumed DECIMAL(10,2),
    Energy_Charge DECIMAL(10,2),
    Fixed_Charge DECIMAL(10,2),
    Tax DECIMAL(10,2),
    Total_Amt DECIMAL(10,2),
    Bill_Date DATE,
    Due_Date DATE,
    Status VARCHAR(20) DEFAULT 'Due',
    CONSTRAINT FK_Bill_Consumers
        FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);

CREATE TABLE Connection_Requests (
    Request_ID INT PRIMARY KEY,
    Applicant_Name VARCHAR(50) NOT NULL,
    Place VARCHAR(60) NOT NULL,
    Address VARCHAR(120) NOT NULL,
    Phone VARCHAR(15) NOT NULL,
    Connection_Type VARCHAR(30) NOT NULL,
    Load_KW DECIMAL(8,2) NOT NULL,
    Status VARCHAR(20) DEFAULT 'Submitted',
    Created_At DATE NOT NULL
);

CREATE TABLE Feedback (
    Feedback_ID INT PRIMARY KEY,
    C_ID INT,
    Place VARCHAR(60),
    Message VARCHAR(250) NOT NULL,
    Created_At DATE NOT NULL,
    CONSTRAINT FK_Feedback_Consumers
        FOREIGN KEY (C_ID) REFERENCES Consumers(C_ID)
);
