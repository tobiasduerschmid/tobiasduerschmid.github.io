package sebook.aadl;

import java.io.DataInputStream;
import java.io.IOException;
import java.lang.reflect.Field;

/**
 * Exact class-file fallback for CheerpJ 5 / Java 25's missing Field native.
 * Returns the RuntimeVisibleTypeAnnotations attribute unchanged, including its
 * original constant-pool indices. Absence returns null, as OpenJDK does.
 * This adapter does not parse AADL or change OSATE's model semantics.
 */
public final class TypeAnnotationBytes {
    private TypeAnnotationBytes() { }

    public static byte[] field(Field field) throws IOException {
        Class<?> owner = field.getDeclaringClass();
        String resource = "/" + owner.getName().replace('.', '/') + ".class";
        try (var stream = owner.getResourceAsStream(resource)) {
            if (stream == null) throw new IOException("Cannot inspect annotations without class resource: " + resource);
            var input = new DataInputStream(stream);
            String[] strings = readConstantPool(input);
            input.skipNBytes(6); // access flags, this class, superclass
            input.skipNBytes(2L * input.readUnsignedShort()); // interfaces
            return readFieldAttribute(input, strings, field);
        }
    }

    private static String[] readConstantPool(DataInputStream input) throws IOException {
        if (input.readInt() != 0xcafebabe) throw new IOException("Invalid Java class-file header.");
        input.readUnsignedShort();
        input.readUnsignedShort();
        String[] strings = new String[input.readUnsignedShort()];
        for (int index = 1; index < strings.length; index++) {
            switch (input.readUnsignedByte()) {
                case 1 -> strings[index] = input.readUTF();
                case 3, 4, 9, 10, 11, 12, 17, 18 -> input.skipNBytes(4);
                case 5, 6 -> { input.skipNBytes(8); index++; }
                case 7, 8, 16, 19, 20 -> input.skipNBytes(2);
                case 15 -> input.skipNBytes(3);
                default -> throw new IOException("Unsupported Java constant-pool entry.");
            }
        }
        return strings;
    }

    private static byte[] readFieldAttribute(DataInputStream input, String[] strings, Field field) throws IOException {
        int fields = input.readUnsignedShort();
        for (int index = 0; index < fields; index++) {
            input.readUnsignedShort();
            String name = strings[input.readUnsignedShort()];
            String descriptor = strings[input.readUnsignedShort()];
            boolean matches = field.getName().equals(name) && field.getType().descriptorString().equals(descriptor);
            byte[] annotations = readAttributes(input, strings, matches);
            if (matches) return annotations;
        }
        throw new IOException("Declaring class does not contain field: " + field.getName());
    }

    private static byte[] readAttributes(DataInputStream input, String[] strings, boolean matches) throws IOException {
        int attributes = input.readUnsignedShort();
        for (int index = 0; index < attributes; index++) {
            String name = strings[input.readUnsignedShort()];
            int length = input.readInt();
            if (length < 0) throw new IOException("Oversized Java class-file attribute.");
            if (matches && name.equals("RuntimeVisibleTypeAnnotations")) {
                byte[] bytes = input.readNBytes(length);
                if (bytes.length != length) throw new IOException("Truncated Java type annotations.");
                return bytes;
            }
            input.skipNBytes(length);
        }
        return null;
    }
}
