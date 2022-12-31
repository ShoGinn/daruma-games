import { Migration } from '@mikro-orm/migrations';

export class Migration20221231032927 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `user` drop `karma`;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table `user` add `karma` int not null default 0;');
  }

}
