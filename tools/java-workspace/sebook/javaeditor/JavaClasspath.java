package sebook.javaeditor;

import java.io.File;
import java.util.*;
import org.eclipse.jdt.core.compiler.CharOperation;
import org.eclipse.jdt.internal.compiler.batch.FileSystem;
import org.eclipse.jdt.internal.compiler.classfmt.ClassFileReader;
import org.eclipse.jdt.internal.compiler.classfmt.ClassFormatException;
import org.eclipse.jdt.internal.compiler.env.INameEnvironment;
import org.eclipse.jdt.internal.compiler.env.NameEnvironmentAnswer;

/** Resolve project classes from the last build and reuse the immutable Java 8 platform classpath. */
final class JavaClasspath implements INameEnvironment {
    private static final FileSystem PLATFORM = new FileSystem(
            Arrays.stream(System.getProperty("sun.boot.class.path").split(File.pathSeparator))
                    .filter(path -> new File(path).exists()).toArray(String[]::new), new String[0], "UTF-8");
    private final Map<String,byte[]> project;
    private final Set<String> packages = new HashSet<>();

    JavaClasspath(Map<String,byte[]> project) {
        this.project = project;
        for (String binaryName : project.keySet()) {
            for (int i = binaryName.indexOf('.'); i >= 0; i = binaryName.indexOf('.', i + 1))
                packages.add(binaryName.substring(0, i));
        }
    }

    @Override public NameEnvironmentAnswer findType(char[][] name) {
        String binaryName = new String(CharOperation.concatWith(name, '.'));
        byte[] bytes = project.get(binaryName);
        if (bytes == null) return PLATFORM.findType(name);
        try {
            return new NameEnvironmentAnswer(new ClassFileReader(bytes, binaryName.toCharArray()), null);
        } catch (ClassFormatException invalid) { throw new IllegalStateException("Invalid compiled class " + binaryName, invalid); }
    }

    @Override public NameEnvironmentAnswer findType(char[] name, char[][] pkg) {
        return findType(CharOperation.arrayConcat(pkg, name));
    }

    @Override public boolean isPackage(char[][] parent, char[] name) {
        String qualified = new String(CharOperation.concatWith(parent, name, '.'));
        if (project.containsKey(qualified)) return false;
        return packages.contains(qualified) || PLATFORM.isPackage(parent, name);
    }

    @Override public void cleanup() { /* The platform classpath lives until the Worker is terminated. */ }
}
