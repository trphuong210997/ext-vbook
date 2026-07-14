load("config.js");

function execute() {
    return Response.success([
        { title: "榜单", input: BASE_URL + "/top/index.php", script: "gen.js" }
    ]);
}
