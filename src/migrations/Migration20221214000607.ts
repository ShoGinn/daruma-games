import { Migration } from '@mikro-orm/migrations';

export class Migration20221214000607 extends Migration {
    async up(): Promise<void> {
        this.addSql('alter table `user` add `karma_shop` json null;');
    }

    override async down(): Promise<void> {
        this.addSql('alter table `user` drop `karma_shop`;');
    }
}
