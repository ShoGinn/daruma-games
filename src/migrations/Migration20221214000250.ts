import { Migration } from '@mikro-orm/migrations';

export class Migration20221214000250 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `algo_std_asset` (`asset_index` int unsigned not null, `created_at` datetime not null, `updated_at` datetime not null, `name` varchar(255) not null, `unit_name` varchar(255) not null, `url` varchar(255) not null, `decimals` int not null default 0, `token_mnemonic` varchar(255) null, primary key (`asset_index`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `algo_txn` (`id` int unsigned not null auto_increment primary key, `created_at` datetime not null, `updated_at` datetime not null, `discord_id` varchar(255) not null, `txn_type` varchar(255) not null, `claim_response` json null) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `daruma_training_channel` (`channel_id` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null, `message_id` varchar(255) not null, `game_type` enum(\'OneVsNpc\', \'OneVsOne\', \'FourVsNpc\') not null, `over_rides` json null, primary key (`channel_id`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `data` (`key` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null, `value` varchar(255) not null default \'\', primary key (`key`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `dt_encounters` (`id` int unsigned not null auto_increment primary key, `created_at` datetime not null, `updated_at` datetime not null, `channel_id` varchar(255) not null, `game_type` enum(\'OneVsNpc\', \'OneVsOne\', \'FourVsNpc\') not null, `game_data` json not null) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `guild` (`id` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null, `prefix` varchar(255) null, `deleted` tinyint(1) not null default false, `last_interact` datetime not null, primary key (`id`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `image` (`id` int unsigned not null auto_increment primary key, `created_at` datetime not null, `updated_at` datetime not null, `file_name` varchar(255) not null, `base_path` varchar(255) not null default \'\', `url` varchar(255) not null, `size` int not null, `tags` text not null, `hash` varchar(255) not null, `delete_hash` varchar(255) not null) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `pastebin` (`id` varchar(255) not null, `edit_code` varchar(255) not null, `lifetime` int not null default -1, `created_at` datetime not null, primary key (`id`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `stat` (`id` int unsigned not null auto_increment primary key, `type` varchar(255) not null, `value` varchar(255) not null default \'\', `additional_data` json null, `created_at` datetime not null) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `user` (`id` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null, `last_interact` datetime not null, `karma` int not null default 0, primary key (`id`)) default character set utf8mb4 engine = InnoDB;');

    this.addSql('create table `algo_wallet` (`wallet_address` varchar(255) not null, `created_at` datetime not null, `updated_at` datetime not null, `rx_wallet` tinyint(1) not null default false, `owner_id` varchar(255) not null, primary key (`wallet_address`)) default character set utf8mb4 engine = InnoDB;');
    this.addSql('alter table `algo_wallet` add index `algo_wallet_owner_id_index`(`owner_id`);');

    this.addSql('create table `algo_std_token` (`id` int unsigned not null auto_increment primary key, `created_at` datetime not null, `updated_at` datetime not null, `owner_wallet_wallet_address` varchar(255) null, `tokens` int null) default character set utf8mb4 engine = InnoDB;');
    this.addSql('alter table `algo_std_token` add index `algo_std_token_owner_wallet_wallet_address_index`(`owner_wallet_wallet_address`);');

    this.addSql('create table `algo_std_asset_owner_tokens` (`algo_std_asset_asset_index` int unsigned not null, `algo_std_token_id` int unsigned not null, primary key (`algo_std_asset_asset_index`, `algo_std_token_id`)) default character set utf8mb4 engine = InnoDB;');
    this.addSql('alter table `algo_std_asset_owner_tokens` add index `algo_std_asset_owner_tokens_algo_std_asset_asset_index_index`(`algo_std_asset_asset_index`);');
    this.addSql('alter table `algo_std_asset_owner_tokens` add index `algo_std_asset_owner_tokens_algo_std_token_id_index`(`algo_std_token_id`);');

    this.addSql('create table `algo_nftasset` (`asset_index` int unsigned not null, `created_at` datetime not null, `updated_at` datetime not null, `creator_wallet_address_wallet_address` varchar(255) not null, `name` varchar(255) not null, `unit_name` varchar(255) not null, `url` varchar(255) not null, `alt_url` tinyint(1) not null default false, `alias` varchar(255) null, `owner_wallet_wallet_address` varchar(255) null, `arc69meta` json null, `asset_note` json null, primary key (`asset_index`)) default character set utf8mb4 engine = InnoDB;');
    this.addSql('alter table `algo_nftasset` add index `algo_nftasset_creator_wallet_address_wallet_address_index`(`creator_wallet_address_wallet_address`);');
    this.addSql('alter table `algo_nftasset` add index `algo_nftasset_owner_wallet_wallet_address_index`(`owner_wallet_wallet_address`);');

    this.addSql('create table `algo_std_asset_owner_wallet` (`algo_std_asset_asset_index` int unsigned not null, `algo_wallet_wallet_address` varchar(255) not null, primary key (`algo_std_asset_asset_index`, `algo_wallet_wallet_address`)) default character set utf8mb4 engine = InnoDB;');
    this.addSql('alter table `algo_std_asset_owner_wallet` add index `algo_std_asset_owner_wallet_algo_std_asset_asset_index_index`(`algo_std_asset_asset_index`);');
    this.addSql('alter table `algo_std_asset_owner_wallet` add index `algo_std_asset_owner_wallet_algo_wallet_wallet_address_index`(`algo_wallet_wallet_address`);');

    this.addSql('alter table `algo_wallet` add constraint `algo_wallet_owner_id_foreign` foreign key (`owner_id`) references `user` (`id`) on update cascade;');

    this.addSql('alter table `algo_std_token` add constraint `algo_std_token_owner_wallet_wallet_address_foreign` foreign key (`owner_wallet_wallet_address`) references `algo_wallet` (`wallet_address`) on update cascade on delete set null;');

    this.addSql('alter table `algo_std_asset_owner_tokens` add constraint `algo_std_asset_owner_tokens_algo_std_asset_asset_index_foreign` foreign key (`algo_std_asset_asset_index`) references `algo_std_asset` (`asset_index`) on update cascade on delete cascade;');
    this.addSql('alter table `algo_std_asset_owner_tokens` add constraint `algo_std_asset_owner_tokens_algo_std_token_id_foreign` foreign key (`algo_std_token_id`) references `algo_std_token` (`id`) on update cascade on delete cascade;');

    this.addSql('alter table `algo_nftasset` add constraint `algo_nftasset_creator_wallet_address_wallet_address_foreign` foreign key (`creator_wallet_address_wallet_address`) references `algo_wallet` (`wallet_address`) on update cascade;');
    this.addSql('alter table `algo_nftasset` add constraint `algo_nftasset_owner_wallet_wallet_address_foreign` foreign key (`owner_wallet_wallet_address`) references `algo_wallet` (`wallet_address`) on update cascade on delete set null;');

    this.addSql('alter table `algo_std_asset_owner_wallet` add constraint `algo_std_asset_owner_wallet_algo_std_asset_asset_index_foreign` foreign key (`algo_std_asset_asset_index`) references `algo_std_asset` (`asset_index`) on update cascade on delete cascade;');
    this.addSql('alter table `algo_std_asset_owner_wallet` add constraint `algo_std_asset_owner_wallet_algo_wallet_wallet_address_foreign` foreign key (`algo_wallet_wallet_address`) references `algo_wallet` (`wallet_address`) on update cascade on delete cascade;');
  }

}
