using System.Security.Cryptography;
using System.Text;
using JojoRpg.Application.Ports.Security;

namespace JojoRpg.Application.Services;

public sealed class GmCodeHasher : IGmCodeHasher
{
    public string Hash(string gmCode)
    {
        byte[] bytes = SHA256.HashData(Encoding.UTF8.GetBytes(gmCode));
        return Convert.ToHexString(bytes);
    }

    public bool Verify(string gmCode, string hash)
    {
        return string.Equals(Hash(gmCode), hash, StringComparison.OrdinalIgnoreCase);
    }
}
