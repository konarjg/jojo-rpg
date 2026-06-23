namespace JojoRpg.Application.Ports.Security;

public interface IRoomCodeGenerator
{
    string GenerateRoomCode(int length);

    string GenerateGmCode(int length);

    string GeneratePlayerCode(int length);
}
