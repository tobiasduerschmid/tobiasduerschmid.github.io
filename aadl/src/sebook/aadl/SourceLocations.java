package sebook.aadl;

import java.util.Map;
import org.eclipse.emf.common.notify.impl.AdapterImpl;
import org.eclipse.emf.ecore.EObject;
import org.eclipse.emf.ecore.resource.Resource;
import org.eclipse.xtext.nodemodel.util.NodeModelUtils;

/** Keeps authored filenames on resources without leaking virtual workspace paths. */
final class SourceLocations extends AdapterImpl {
    private final String file;

    private SourceLocations(String file) { this.file = file; }

    static void attach(Resource resource, String file) {
        resource.eAdapters().add(new SourceLocations(file));
    }

    static String file(Resource resource) {
        for (var adapter : resource.eAdapters()) {
            if (adapter instanceof SourceLocations source) return source.file;
        }
        return null;
    }

    static Map<String, Object> location(EObject item) {
        if (item == null || item.eResource() == null) return Map.of();
        String file = file(item.eResource());
        var node = NodeModelUtils.getNode(item);
        if (file == null || node == null) return Map.of();
        var start = NodeModelUtils.getLineAndColumn(node, node.getOffset());
        var end = NodeModelUtils.getLineAndColumn(node, node.getEndOffset());
        return Map.of("file", file, "line", start.getLine(), "column", start.getColumn(), "endLine", end.getLine(), "endColumn", end.getColumn());
    }
}
