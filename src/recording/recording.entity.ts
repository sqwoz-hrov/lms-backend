import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('recordings')
export class Recording {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	url: string;
}
