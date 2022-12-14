import { Migration } from '@mikro-orm/migrations';

export class Migration20221214000515 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop table if exists `image`;');

    this.addSql('drop table if exists `pastebin`;');

    this.addSql('drop table if exists `stat`;');
  }

  async down(): Promise<void> {
    this.addSql('create table `image` (`id` int unsigned not null auto_increment primary key, `created_at` datetime not null, `updated_at` datetime not null, `file_name` varchar(255) not null, `base_path` varchar(255) not null default , `url` varchar(255) not null, `size` int not null, `tags` text not null, `hash` varchar(255) not null, `delete_hash` varchar(255) not null) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `pastebin` (`id` varchar(255) not null, `edit_code` varchar(255) not null, `lifetime` int not null default -1, `created_at` datetime not null, primary key (`id`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `stat` (`id` int unsigned not null auto_increment primary key, `type` varchar(255) not null, `value` varchar(255) not null default , `additional_data` json null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;');
  }

}
