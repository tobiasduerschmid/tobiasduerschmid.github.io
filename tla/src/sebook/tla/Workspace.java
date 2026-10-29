package sebook.tla;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import util.SimpleFilenameToStream;

/** Owns one request's private virtual files. No source is loaded from a remote service. */
final class Workspace implements AutoCloseable {
    final Path directory;
    final String entry;
    final String config;
    final SourceLocations locations;
    final List<String> modules = new ArrayList<>();

    Workspace(JsonObject request) throws IOException {
        entry = filename(Bridge.string(request, "entry", "Spec.tla"), ".tla");
        config = filename(Bridge.string(request, "config", entry.replaceFirst("\\.tla$", ".cfg")), ".cfg");
        locations = new SourceLocations();
        JsonObject files = request.getAsJsonObject("files");
        if (files == null || !files.has(entry)) throw new IllegalArgumentException("The entry module is missing from files.");
        if (!Bridge.string(request, "operation", "check").equals("parse") && !files.has(config))
            throw new IllegalArgumentException("The model configuration is missing from files: " + config);
        for (String name : files.keySet()) {
            filename(name, null);
            if (!name.endsWith(".tla") && !name.endsWith(".cfg"))
                throw new IllegalArgumentException("Only .tla and .cfg files are accepted.");
            if (name.endsWith(".tla")) modules.add(name);
        }
        Path root = Paths.get(System.getProperty("sebook.tla.workRoot", System.getProperty("java.io.tmpdir")));
        Files.createDirectories(root);
        directory = Files.createTempDirectory(root, "sebook-tla-");
        for (Map.Entry<String, JsonElement> file : files.entrySet()) {
            write(file.getKey(), file.getValue().getAsString());
        }
    }

    private static String filename(String value, String suffix) {
        if (!value.matches("[A-Za-z_][A-Za-z_0-9.-]*") || value.contains("..")
                || (suffix != null && !value.endsWith(suffix)))
            throw new IllegalArgumentException("Invalid module or configuration filename: " + value);
        return value;
    }

    Path path(String name) { return directory.resolve(name); }
    String source(String module) throws IOException { return Files.readString(path(module)); }
    void write(String name, String content) throws IOException {
        Files.write(path(name), content.getBytes(StandardCharsets.UTF_8));
    }
    SimpleFilenameToStream resolver() { return new SimpleFilenameToStream(directory.toString()); }

    @Override public void close() throws IOException { remove(directory); }
    private static void remove(Path path) throws IOException {
        if (Files.isDirectory(path)) {
            try (java.nio.file.DirectoryStream<Path> children = Files.newDirectoryStream(path)) {
                for (Path child : children) remove(child);
            }
        }
        Files.deleteIfExists(path);
    }
}
