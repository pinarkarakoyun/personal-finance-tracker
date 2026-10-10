-- Personal Finance Tracker: database schema (SQL Server)
-- Create the database first:  CREATE DATABASE FinanceTracker;

USE FinanceTracker;
GO

CREATE TABLE Users (
    UserId        INT IDENTITY(1,1) PRIMARY KEY,
    FullName      NVARCHAR(100) NOT NULL,
    Email         NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash  NVARCHAR(255) NOT NULL,
    CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE Categories (
    CategoryId  INT IDENTITY(1,1) PRIMARY KEY,
    UserId      INT NOT NULL FOREIGN KEY REFERENCES Users(UserId),
    Name        NVARCHAR(50) NOT NULL,
    Type        NVARCHAR(10) NOT NULL CHECK (Type IN ('Income', 'Expense'))
);

CREATE TABLE Transactions (
    TransactionId    INT IDENTITY(1,1) PRIMARY KEY,
    UserId           INT NOT NULL FOREIGN KEY REFERENCES Users(UserId),
    CategoryId       INT NOT NULL FOREIGN KEY REFERENCES Categories(CategoryId),
    Amount           DECIMAL(12,2) NOT NULL CHECK (Amount > 0),
    Description      NVARCHAR(255) NULL,
    TransactionDate  DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE)
);