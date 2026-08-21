export interface SMBusInstance {
	close(): void;
}

export type SMBusConstructor<Bus extends SMBusInstance, Options extends { address: number }> = new (
	options: Options,
) => Bus;

export class SMBusDevice<Bus extends SMBusInstance, Options extends { address: number }> {
	#IO: SMBusConstructor<Bus, Options>;
	#options: Omit<Options, "address">;
	#bus?: Bus;
	#name: string;

	protected constructor(
		IO: SMBusConstructor<Bus, Options>,
		options: Omit<Options, "address">,
		address: number,
		name: string,
	) {
		this.#IO = IO;
		this.#options = options;
		this.#name = name;
		this.reconnect(address);
	}

	protected reconnect(address: number): void {
		this.close();
		this.#bus = new this.#IO({ ...this.#options, address } as Options);
	}

	protected get activeBus(): Bus {
		if (!this.#bus) throw new Error(`${this.#name} bus is closed`);
		return this.#bus;
	}

	public close(): void {
		this.#bus?.close();
		this.#bus = undefined;
	}
}
