using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatBotAdmin.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BrandColor",
                table: "DocumentChatBots",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BrandColor",
                table: "DocumentChatBots");
        }
    }
}
