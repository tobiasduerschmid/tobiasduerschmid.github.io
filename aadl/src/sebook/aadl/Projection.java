package sebook.aadl;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.emf.ecore.EObject;
import org.osate.aadl2.NamedElement;
import org.osate.aadl2.instance.ComponentInstance;
import org.osate.aadl2.instance.ConnectionInstance;
import org.osate.aadl2.instance.EndToEndFlowInstance;
import org.osate.aadl2.instance.FeatureInstance;
import org.osate.aadl2.instance.FlowSpecificationInstance;
import org.osate.aadl2.instance.InstanceObject;
import org.osate.aadl2.instance.SystemInstance;
import org.osate.xtext.aadl2.properties.util.GetProperties;

/** Projects semantic instance objects; never reparses or infers AADL from text. */
final class Projection {
    private Projection() { }

    static Map<String, Object> model(SystemInstance root) {
        List<Map<String, Object>> components = new ArrayList<>();
        List<Map<String, Object>> connections = new ArrayList<>();
        List<Map<String, Object>> bindings = new ArrayList<>();
        List<Map<String, Object>> flows = new ArrayList<>();
        List<ComponentInstance> all = new ArrayList<>();
        collect(root, all);
        for (ComponentInstance component : all) {
            components.add(component(component, root));
            for (var connection : component.getConnectionInstances()) connections.add(connection(connection));
            for (var target : GetProperties.getActualProcessorBinding(component)) bindings.add(Map.of("sourceId", id(component), "targetId", id(target), "kind", "processor"));
            for (var target : GetProperties.getActualMemoryBinding(component)) bindings.add(Map.of("sourceId", id(component), "targetId", id(target), "kind", "memory"));
            for (var flow : component.getFlowSpecifications()) flows.add(flow(flow));
            for (var flow : component.getEndToEndFlows()) flows.add(flow(flow));
        }
        return Map.of("rootId", id(root), "components", components, "connections", connections, "bindings", bindings, "flows", flows);
    }

    private static void collect(ComponentInstance item, List<ComponentInstance> target) {
        target.add(item);
        for (var child : item.getComponentInstances()) collect(child, target);
    }

    private static Map<String, Object> component(ComponentInstance item, SystemInstance root) {
        var result = named(item);
        result.put("parentId", item == root ? null : id(item.getContainingComponentInstance()));
        result.put("category", item.getCategory().getLiteral());
        result.put("classifier", item.getComponentClassifier().getQualifiedName());
        result.put("features", item.getFeatureInstances().stream().map(Projection::feature).toList());
        result.put("source", location(item.getSubcomponent() == null ? item.getComponentClassifier() : item.getSubcomponent()));
        return result;
    }

    private static Map<String, Object> feature(FeatureInstance item) {
        var result = named(item);
        result.put("direction", item.getDirection().getLiteral());
        result.put("kind", item.getCategory().getLiteral());
        var classifier = item.getFeature().getAllClassifier();
        if (classifier != null) result.put("dataClassifier", classifier.getQualifiedName());
        result.put("source", location(item.getFeature()));
        result.put("features", item.getFeatureInstances().stream().map(Projection::feature).toList());
        return result;
    }

    private static Map<String, Object> connection(ConnectionInstance item) {
        var result = named(item);
        result.put("source", id(item.getSource()));
        result.put("target", id(item.getDestination()));
        result.put("contextId", id(item.getContainingComponentInstance()));
        result.put("kind", item.getKind().getLiteral());
        result.put("bidirectional", item.isBidirectional());
        List<Map<String, Object>> segments = new ArrayList<>();
        for (var reference : item.getConnectionReferences()) {
            var segment = named(reference);
            segment.put("name", reference.getConnection().getName());
            segment.put("contextId", id(reference.getContext()));
            segment.put("source", id(reference.getSource()));
            segment.put("target", id(reference.getDestination()));
            segment.put("sourceLocation", location(reference.getConnection()));
            segments.add(segment);
        }
        result.put("segments", segments);
        result.put("latency", latency(item));
        return result;
    }

    private static Map<String, Object> flow(InstanceObject item) {
        var result = named(item);
        result.put("contextId", id(item.getContainingComponentInstance()));
        result.put("latency", latency(item));
        if (item instanceof FlowSpecificationInstance flow) {
            result.put("kind", flow.getFlowSpecification().getKind().getLiteral());
            result.put("source", id(flow.getSource()));
            result.put("target", id(flow.getDestination()));
            result.put("sourceLocation", location(flow.getFlowSpecification()));
        } else if (item instanceof EndToEndFlowInstance flow) {
            result.put("kind", "end-to-end");
            result.put("elements", flow.getFlowElements().stream().map(Projection::id).toList());
            result.put("sourceLocation", location(flow.getEndToEndFlow()));
        }
        return result;
    }

    private static Map<String, Object> latency(NamedElement item) {
        var property = GetProperties.lookupPropertyDefinition(item, "Communication_Properties", "Latency");
        var associations = item.getPropertyValue(property).getAssociations();
        var result = new LinkedHashMap<String, Object>();
        result.put("present", !associations.isEmpty());
        if (!associations.isEmpty()) {
            result.put("minimumMs", GetProperties.getMinimumLatencyinMilliSec(item));
            result.put("maximumMs", GetProperties.getMaximumLatencyinMilliSec(item));
            var sources = associations.stream().map(Projection::location).filter(location -> !location.isEmpty()).toList();
            result.put("sourceAvailable", sources.size() == associations.size());
            result.put("sources", sources);
        }
        return result;
    }

    private static LinkedHashMap<String, Object> named(InstanceObject item) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", id(item));
        result.put("name", item.getName());
        return result;
    }

    static String id(EObject item) {
        return item instanceof InstanceObject instance ? instance.getInstanceObjectPath() : null;
    }

    static Map<String, Object> location(EObject item) {
        return SourceLocations.location(item);
    }
}
