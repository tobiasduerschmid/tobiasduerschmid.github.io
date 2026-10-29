package sebook.tla;

import java.lang.reflect.Proxy;
import java.util.Collections;
import javax.management.MBeanServer;
import javax.management.MBeanServerBuilder;
import javax.management.MBeanServerDelegate;
import javax.management.ObjectInstance;
import javax.management.ObjectName;

/** Disables desktop JMX monitoring, which needs native management APIs absent in browser JVMs. */
public final class BrowserMBeanServerBuilder extends MBeanServerBuilder {
    @Override public MBeanServer newMBeanServer(String domain, MBeanServer outer, MBeanServerDelegate delegate) {
        return (MBeanServer) Proxy.newProxyInstance(MBeanServer.class.getClassLoader(),
                new Class<?>[] { MBeanServer.class }, (proxy, method, args) -> {
                    if (method.getName().equals("registerMBean"))
                        return new ObjectInstance((ObjectName) args[1], args[0].getClass().getName());
                    Class<?> type = method.getReturnType();
                    if (type == boolean.class) return false;
                    if (type == int.class || type == Integer.class) return 0;
                    if (type == String.class) return "sebook";
                    if (type == String[].class) return new String[0];
                    if (java.util.Set.class.isAssignableFrom(type)) return Collections.emptySet();
                    return null;
                });
    }
}
