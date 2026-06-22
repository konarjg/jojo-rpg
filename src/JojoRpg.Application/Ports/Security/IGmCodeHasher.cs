namespace JojoRpg.Application.Ports.Security;

public interface IGmCodeHasher
{
    string Hash(string gmCode);

    bool Verify(string gmCode, string hash);
}
