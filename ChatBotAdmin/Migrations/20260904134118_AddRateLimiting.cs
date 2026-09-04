using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatBotAdmin.Migrations
{
    /// <inheritdoc />
    public partial class AddRateLimiting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RateLimitConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BotId = table.Column<Guid>(type: "TEXT", nullable: true),
                    RequestsPerMinute = table.Column<int>(type: "INTEGER", nullable: false),
                    RequestsPerHour = table.Column<int>(type: "INTEGER", nullable: false),
                    RequestsPerDay = table.Column<int>(type: "INTEGER", nullable: false),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RateLimitConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RequestLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BotId = table.Column<Guid>(type: "TEXT", nullable: true),
                    TimestampUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    WasThrottled = table.Column<bool>(type: "INTEGER", nullable: false),
                    ClientIp = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RateLimitConfigs_BotId",
                table: "RateLimitConfigs",
                column: "BotId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_BotId",
                table: "RequestLogs",
                column: "BotId");

            migrationBuilder.CreateIndex(
                name: "IX_RequestLogs_TimestampUtc",
                table: "RequestLogs",
                column: "TimestampUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RateLimitConfigs");

            migrationBuilder.DropTable(
                name: "RequestLogs");
        }
    }
}
