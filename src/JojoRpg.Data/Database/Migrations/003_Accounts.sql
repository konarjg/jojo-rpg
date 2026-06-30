CREATE TABLE Accounts (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Email NVARCHAR(256) NOT NULL,
    PasswordHash NVARCHAR(512) NOT NULL,
    DisplayName NVARCHAR(128) NULL,
    CreatedAt DATETIMEOFFSET NOT NULL,
    UpdatedAt DATETIMEOFFSET NOT NULL,
    DeletedAt DATETIMEOFFSET NULL,
    CONSTRAINT UQ_Accounts_Email UNIQUE (Email)
);

CREATE INDEX IX_Accounts_DeletedAt ON Accounts(DeletedAt);

GO

ALTER TABLE Rooms ADD OwnerAccountId UNIQUEIDENTIFIER NULL;
ALTER TABLE Players ADD AccountId UNIQUEIDENTIFIER NULL;
ALTER TABLE RoomSessions ADD AccountId UNIQUEIDENTIFIER NULL;

GO

ALTER TABLE Rooms
    ADD CONSTRAINT FK_Rooms_OwnerAccount FOREIGN KEY (OwnerAccountId) REFERENCES Accounts(Id);

ALTER TABLE Players
    ADD CONSTRAINT FK_Players_Accounts FOREIGN KEY (AccountId) REFERENCES Accounts(Id);

ALTER TABLE RoomSessions
    ADD CONSTRAINT FK_RoomSessions_Accounts FOREIGN KEY (AccountId) REFERENCES Accounts(Id);

GO

CREATE INDEX IX_Rooms_OwnerAccountId ON Rooms(OwnerAccountId) WHERE OwnerAccountId IS NOT NULL;
CREATE INDEX IX_Players_AccountId ON Players(AccountId) WHERE AccountId IS NOT NULL;
CREATE INDEX IX_RoomSessions_AccountId ON RoomSessions(AccountId) WHERE AccountId IS NOT NULL;

CREATE UNIQUE INDEX UQ_Players_RoomId_AccountId
    ON Players(RoomId, AccountId)
    WHERE AccountId IS NOT NULL;
