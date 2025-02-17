import { IEditor, INode, IPlugin, INodeInterface, IConnection } from "../../baklavajs-core/types";
import { IInterfaceTypePlugin } from "../../baklavajs-plugin-interface-types/types";
import { calculateOrder, containsCycle } from "./nodeTreeBuilder";

export class Engine implements IPlugin {

    public type = "EnginePlugin";

    public get rootNodes() {
        return this._rootNodes;
    }

    public set rootNodes(value: INode[]|undefined) {
        this._rootNodes = value;
        this.recalculateOrder = true;
    }

    private editor!: IEditor;
    private nodeCalculationOrder: INode[] = [];
    private connectionsPerNode = new Map<INode, IConnection[]>();
    private recalculateOrder = false;
    private calculateOnChange = false;
    private calculationInProgress = false;
    private _rootNodes: INode[]|undefined = undefined;
    private interfaceTypePlugins: IInterfaceTypePlugin[] = [];

    /**
     * Construct a new Engine plugin
     * @param calculateOnChange Whether to automatically calculate all nodes when any node interface or node option is changed.
     */
    public constructor(calculateOnChange = false) {
        this.calculateOnChange = calculateOnChange;
    }

    public register(editor: IEditor) {
        this.editor = editor;

        // Search for previously registered interface type plugins
        this.editor.plugins.forEach((p) => {
            if (p.type === "InterfaceTypePlugin") {
                this.interfaceTypePlugins.push(p as IInterfaceTypePlugin);
            }
        });
        // Watch for newly registered interface type plugins
        this.editor.events.usePlugin.addListener(this, (p) => {
            if (p.type === "InterfaceTypePlugin") {
                this.interfaceTypePlugins.push(p as IInterfaceTypePlugin);
            }
        });

        this.editor.events.addNode.addListener(this, (node) => {
            node.events.update.addListener(this, (ev) => {
                if (ev.interface && ev.interface.connectionCount === 0) {
                    this.onChange(false);
                } else if (ev.option) {
                    this.onChange(false);
                }
            });
            this.onChange(true);
        });

        this.editor.events.removeNode.addListener(this, (node) => {
            node.events.update.removeListener(this);
        });

        this.editor.events.checkConnection.addListener(this, (c) => {
            if (!this.checkConnection(c.from, c.to)) { return false; }
        });

        this.editor.events.addConnection.addListener(this, (c) => { this.onChange(true); });
        this.editor.events.removeConnection.addListener(this, () => { this.onChange(true); });

    }

    /**
     * Calculate all nodes.
     * This will automatically calculate the node calculation order if necessary and
     * transfer values between connected node interfaces.
     */
    public async calculate() {
        this.calculationInProgress = true;
        if (this.recalculateOrder) {
            this.calculateOrder();
        }
        for (const n of this.nodeCalculationOrder) {
            await n.calculate();
            if (this.connectionsPerNode.has(n)) {
                this.connectionsPerNode.get(n)!.forEach((c) => {
                    const conversion = this.interfaceTypePlugins.find(
                        (p) => p.canConvert((c.from as any).type, (c.to as any).type));
                    if (conversion) {
                        c.to.value = conversion.convert((c.from as any).type, (c.to as any).type, c.from.value);
                    } else {
                        c.to.value = c.from.value;
                    }
                });
            }
        }
        this.calculationInProgress = false;
    }

    /**
     * Force the engine to recalculate the node execution order.
     * This is normally done automatically. Use this method if the
     * default change detection does not work in your scenario.
     */
    public calculateOrder() {
        this.calculateNodeTree();
        this.recalculateOrder = false;
    }

    private checkConnection(from: INodeInterface, to: INodeInterface) {
        const dc = { from, to, id: "dc", destructed: false, isInDanger: false } as IConnection;
        const copy = (this.editor.connections as ReadonlyArray<IConnection>).concat([dc]);
        copy.filter((conn) => conn.to !== to);
        return containsCycle(this.editor.nodes, copy);
    }

    private onChange(recalculateOrder: boolean) {
        this.recalculateOrder = this.recalculateOrder || recalculateOrder;
        if (this.calculateOnChange && !this.calculationInProgress) {
            this.calculate();
        }
    }

    private calculateNodeTree() {
        this.nodeCalculationOrder = calculateOrder(this.editor.nodes, this.editor.connections, this.rootNodes);
        this.connectionsPerNode.clear();
        this.editor.nodes.forEach((n) => {
            this.connectionsPerNode.set(n, this.editor.connections.filter((c) => c.from.parent === n));
        });
    }

}
