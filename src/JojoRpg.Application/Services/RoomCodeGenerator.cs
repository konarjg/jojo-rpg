using System.Security.Cryptography;
using JojoRpg.Application.Ports.Security;

namespace JojoRpg.Application.Services;

public sealed class RoomCodeGenerator : IRoomCodeGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public string GenerateRoomCode(int length)
    {
        return Generate(length);
    }

    public string GenerateGmCode(int length)
    {
        return Generate(length);
    }

    public string GeneratePlayerCode(int length)
    {
        return Generate(length);
    }

    private static string Generate(int length)
    {
        char[] chars = new char[length];
        for (int i = 0; i < length; i++)
        {
            int index = RandomNumberGenerator.GetInt32(Alphabet.Length);
            chars[i] = Alphabet[index];
        }

        return new string(chars);
    }
}
