package sebook.javaeditor;

import com.google.gson.*;
import java.io.*;
import java.util.*;
import org.eclipse.jdt.core.compiler.CategorizedProblem;
import org.eclipse.jdt.internal.compiler.*;
import org.eclipse.jdt.internal.compiler.Compiler;
import org.eclipse.jdt.internal.compiler.ast.*;
import org.eclipse.jdt.internal.compiler.batch.CompilationUnit;
import org.eclipse.jdt.internal.compiler.classfmt.ClassFileConstants;
import org.eclipse.jdt.internal.compiler.classfmt.ClassFileReader;
import org.eclipse.jdt.internal.compiler.classfmt.ClassFormatException;
import org.eclipse.jdt.internal.compiler.impl.CompilerOptions;
import org.eclipse.jdt.internal.compiler.parser.Parser;
import org.eclipse.jdt.internal.compiler.problem.*;

final class JavaBuild {
    final Map<String,byte[]> classes = new LinkedHashMap<>();
    final Map<String,List<String>> types = new LinkedHashMap<>();
    final JsonArray diagnostics = new JsonArray();
    final JsonArray bindings;
    boolean success = true;
    String compilerOutput;

    JavaBuild(Map<String,String> files, Map<String,byte[]> classpath, boolean resolveSymbols) {
        Semantics symbols = resolveSymbols ? new Semantics() : null;
        bindings = symbols == null ? new JsonArray() : symbols.bindings();
        CompilationUnit[] units = files.entrySet().stream()
                .map(file -> new CompilationUnit(file.getValue().toCharArray(), file.getKey(), "UTF-8"))
                .toArray(CompilationUnit[]::new);
        Map<String,String> settings = new HashMap<>();
        settings.put(CompilerOptions.OPTION_Source, "1.8");
        settings.put(CompilerOptions.OPTION_TargetPlatform, "1.8");
        settings.put(CompilerOptions.OPTION_Compliance, "1.8");
        settings.put(CompilerOptions.OPTION_SourceFileAttribute, CompilerOptions.GENERATE);
        settings.put(CompilerOptions.OPTION_LocalVariableAttribute, CompilerOptions.GENERATE);
        settings.put(CompilerOptions.OPTION_LineNumberAttribute, CompilerOptions.GENERATE);
        CompilerOptions options = new CompilerOptions(settings);
        options.preserveAllLocalVariables = true;
        StringWriter output = new StringWriter();
        PrintWriter messages = new PrintWriter(output);
        Compiler compiler = new Compiler(new JavaClasspath(classpath), DefaultErrorHandlingPolicies.proceedWithAllProblems(),
                options, result -> {
            String path = new String(result.getFileName());
            CategorizedProblem[] problems = result.getProblems();
            if (problems != null) for (CategorizedProblem problem : problems) {
                diagnostics.add(diagnostic(path, files.get(path), problem));
                messages.printf("%s:%d: %s: %s%n", path, problem.getSourceLineNumber(),
                        problem.isError() ? "error" : "warning", problem.getMessage());
            }
            if (result.hasErrors()) { success = false; return; }
            List<String> declared = new ArrayList<>();
            for (ClassFile emitted : result.getClassFiles()) {
                String binaryName = new String(emitted.fileName()).replace('/', '.');
                declared.add(binaryName);
                classes.put(binaryName, emitted.getBytes());
            }
            types.put(path, declared);
        }, new DefaultProblemFactory(Locale.ROOT)) {
            @Override public void process(CompilationUnitDeclaration unit, int index) {
                super.process(unit, index);
                String path = new String(unit.getFileName());
                if (symbols != null && unit.scope != null) symbols.collect(unit, path, files.get(path));
            }
        };
        compiler.useSingleThread = true;
        compiler.compile(units);
        compilerOutput = output.toString();
    }

    /**
     * Rebuild an edited unit against unmodified sibling classes. ECJ checks the same structural
     * changes used by its incremental builder (including overloads, generic signatures, checked
     * exceptions and inlinable constants). On any change visible to a caller, rebuild everything.
     */
    boolean updateBody(String path, String source) {
        if (!success || types.size() < 2 || !types.containsKey(path)) return false;
        // ECJ keys for a secondary top-level source type include the source filename. Compiling
        // against its binary instead would change editor reference identities across revisions.
        for (Map.Entry<String,List<String>> file : types.entrySet()) {
            String name = new File(file.getKey()).getName();
            for (String binary : file.getValue()) {
                String simple = binary.substring(binary.lastIndexOf('.') + 1);
                int nested = simple.indexOf('$');
                if (!(nested < 0 ? simple : simple.substring(0, nested)).concat(".java").equals(name)) return false;
            }
        }
        Map<String,byte[]> dependencies = new HashMap<>(classes);
        for (String binary : types.get(path)) dependencies.remove(binary);
        JavaBuild next = new JavaBuild(Collections.singletonMap(path, source), dependencies, true);
        if (!next.success || !next.classes.keySet().equals(new HashSet<>(types.get(path)))) return false;
        try {
            for (Map.Entry<String,byte[]> output : next.classes.entrySet()) {
                String name = output.getKey();
                ClassFileReader before = new ClassFileReader(classes.get(name), name.toCharArray());
                if (before.hasStructuralChanges(output.getValue(), true, false)) return false;
            }
        } catch (ClassFormatException invalid) { return false; }
        classes.putAll(next.classes);
        replaceFile(bindings, path, next.bindings);
        replaceFile(diagnostics, path, next.diagnostics);
        return true;
    }

    private static void replaceFile(JsonArray items, String path, JsonArray replacements) {
        for (Iterator<JsonElement> it = items.iterator(); it.hasNext();)
            if (path.equals(it.next().getAsJsonObject().get("file").getAsString())) it.remove();
        items.addAll(replacements);
    }

    private static JsonObject diagnostic(String file, String source, CategorizedProblem problem) {
        int[] start = point(source, problem.getSourceStart());
        int[] end = point(source, problem.getSourceEnd() + 1);
        JsonObject item = new JsonObject();
        item.addProperty("file", file);
        item.addProperty("message", problem.getMessage());
        item.addProperty("severity", problem.isError() ? "error" : "warning");
        item.addProperty("line", start[0]);
        item.addProperty("column", start[1]);
        item.addProperty("endLine", end[0]);
        item.addProperty("endColumn", end[1]);
        return item;
    }

    private static int[] point(String source, int offset) {
        int line = 1, column = 1;
        for (int i = 0; i < offset && i < source.length(); i++) {
            char c = source.charAt(i);
            if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < Math.min(offset, source.length()) && source.charAt(i + 1) == '\n') i++;
                line++;
                column = 1;
            } else column++;
        }
        return new int[]{line, column};
    }

    // ECJ's declaration parser also handles comments and helper classes before the public test class.
    static Map<String,String> harness(String code) {
        CompilationUnit input = new CompilationUnit(code.toCharArray(), "__Test.java", "UTF-8");
        ProblemReporter reporter = new ProblemReporter(DefaultErrorHandlingPolicies.proceedWithAllProblems(),
                new CompilerOptions(), new DefaultProblemFactory(Locale.ROOT));
        CompilationUnitDeclaration unit = new Parser(reporter, false).dietParse(input, new CompilationResult(input, 0, 1, 100));
        if (unit.types != null && unit.types.length > 0) {
            TypeDeclaration primary = unit.types[0];
            for (TypeDeclaration type : unit.types) if ((type.modifiers & ClassFileConstants.AccPublic) != 0) { primary = type; break; }
            return Collections.singletonMap(new String(primary.name) + ".java", code);
        }
        return Collections.singletonMap("__Snippet.java", "public class __Snippet { public static void main(String[] args) throws Exception {\n" + code + "\n} }");
    }
}
