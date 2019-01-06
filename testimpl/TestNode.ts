import { Node, NodeInterface } from "../src/model";
import InputOption from "../src/options/InputOption.vue";
import CheckboxOption from "../src/options/CheckboxOption.vue";
import NumberOption from "../src/options/NumberOption.vue";
import SelectOption from "../src/options/SelectOption.vue";

export default class TestNode extends Node {

    public type = "TestNode";
    public name = this.type;

    constructor() {
        super();
        this.options = {
            "This is a checkbox": true,
            "Select": {
                selected: "Test1",
                items: [ "Test1", "Test2", "Test3" ]
            }
        };
    }

    public calculate() {
        this.interfaces.OutputIF.value = this.interfaces.InputIF.value;
    }

    public getInterfaces(): Record<string, NodeInterface> {
        return {
            InputIF: new NodeInterface(this, true, "boolean", InputOption),
            OutputIF: new NodeInterface(this, false, "boolean")
        };
    }

    public getOptions() {
        return {
            "test": InputOption,
            "Select": SelectOption,
            "This is a checkbox": CheckboxOption,
            "Number": NumberOption
        };
    }

}
