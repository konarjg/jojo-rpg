ALTER TABLE Players ADD PlayerCodeHash NVARCHAR(128) NULL;
GO

CREATE UNIQUE INDEX UQ_Players_RoomId_PlayerCodeHash
    ON Players(RoomId, PlayerCodeHash)
    WHERE PlayerCodeHash IS NOT NULL;
GO
