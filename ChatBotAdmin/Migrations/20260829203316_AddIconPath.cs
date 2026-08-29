using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatBotAdmin.Migrations
{
    /// <inheritdoc />
    public partial class AddIconPath : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IconPath",
                table: "DocumentChatBots",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IconPath",
                table: "DocumentChatBots");
        }
    }
}
