/**
 * The Purpose of this project was to bully snow.
 * it's all creative idea's i've made all store into 1 file,
 * this is the first time i've make a src like this. 
 * so it may be messey with everything all over the place
 * 
 * Made By Avieah
 * Date: 1/3/25
 */

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonStyle,
    PermissionsBitField,
    Events,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    WebhookClient
} = require('discord.js');
const {
    UserStats
} = require('./database');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({
    intents: [Object.keys(GatewayIntentBits)],
    partials: [Object.keys(Partials)]
})

const {
    TOKEN,
    CLIENT_ID,
    TARGET_USER_ID,
    ROLE_ID,
    CHANNEL_ID,
    WEBHOOK_URL
} = process.env;

const uve = new WebhookClient({
    url: WEBHOOK_URL
});

const state = {
    buttonPressed: false,
    uveUpdate: null
};

const commands = [
    new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the kick/ban leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clearmsgs')
    .setDescription('Clear a number of messages from a specific user')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addUserOption(option =>
        option
        .setName('user')
        .setDescription('The user whose messages to delete')
        .setRequired(true)
    )
    .addIntegerOption(option =>
        option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option
        .setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option
        .setName('role')
        .setDescription('The role to remove from the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Assign a role to a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option
        .setName('user')
        .setDescription('The user to assign the role to')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option
        .setName('role')
        .setDescription('The role to assign to the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gkick')
    .setDescription('Kick one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addStringOption(option =>
        option
        .setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to kick.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option
        .setName('global')
        .setDescription('Kick users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gban')
    .setDescription('Ban one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addStringOption(option =>
        option
        .setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to ban.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option
        .setName('global')
        .setDescription('Ban users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

(async () => {
    try {
        console.log("Refreshing application (/) commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands
        });
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error refreshing commands:", error);
    }
})();


client.once(Events.ClientReady, () => {
    console.log(`${client.user.username} is online in ${client.guilds.cache.size} guild(s).`);

    // Schedule the task to run every hour
    cron.schedule('0 * * * *', async () => {
        try {
            if (!state.buttonPressed) {
                const guild = client.guilds.cache.first();
                const uvechannel = client.channels.cache.get(CHANNEL_ID);

                // Check if Snow is in the server
                const member = await guild.members.fetch(TARGET_USER_ID).catch(() => null);


                /**
                 * if snow in the server we send a embed that constantly keeps updating till pressed. 
                 * when pressed it'll send a new one insteead of keep resending new ones
                 */
                if (member) {
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                            .setCustomId('kick_button')
                            .setLabel('Kick Snow')
                            .setStyle(ButtonStyle.Danger)
                        );

                    const embed = new EmbedBuilder()
                        .setDescription('Press the button to kick Snow')
                        .setColor('Purple');

                    // this is bad but only way i know how to write it sadly.
                    if (state.uveUpdate) {
                        await state.uveUpdate.edit({
                            embeds: [embed],
                            components: [row]
                        });
                    } else {
                        state.uveUpdate = await uvechannel.send({
                            embeds: [embed],
                            components: [row]
                        });
                    }
                }
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    });
});

client.on(Events.GuildBanAdd, async (ban) => {
    const {
        user,
        guild
    } = ban;
    console.log(`User ${user.username} was banned from ${guild.name}`);

    try {
        await UserStats.findOneAndUpdate({
            userId: user.id
        }, {
            $inc: {
                bans: 1
            }
        }, {
            upsert: true,
            new: true
        });
    } catch (err) {
        console.error('Error updating ban count:', err);
    }
});

client.on(Events.GuildMemberAdd, async (member) => {
    if (member.id === TARGET_USER_ID) {
        const role = member.guild.roles.cache.get(ROLE_ID);
        if (!role) return console.error('Role not found');

        try {
            // we had 'head mod' role to snow. 
            await member.roles.add(role);
        } catch (error) {
            console.error('Failed to assign role:', error);
        }
    }
});

client.on(Events.GuildMemberRemove, async (member) => {
    const {
        user,
        guild
    } = member;

    try {
        /**
         * it's where we log the AuditLogs and only listen to users who got kicked/banned.
         */
        const auditLogs = await guild.fetchAuditLogs({
            type: 20, // 20 is the audit log type for kicks
            limit: 1
        });

        const logEntry = auditLogs.entries.first()
        if (logEntry && logEntry.target.id === user.id) {
            console.log(`User ${user.username} was kicked from ${guild.name}`);

            await UserStats.findOneAndUpdate({
                userId: user.id
            }, {
                $inc: {
                    kicks: 1
                }
            }, {
                upsert: true,
                new: true
            });
            /**
             * unfortunately, can't use this code because for some reason dms are still turned off makes no sense.
             */

            //     // we create the invite for snow, beause this mf keeps getting kicked HEHE
            //     const invite = await guild.invites.create(guild.channels.cache.first(), {
            //         maxUses: 1,
            //         unique: true
            //     });
            //     console.log(`Invite created for ${user.username}: ${invite.url}`);

            //     // send this mf a invite using his Id (i got lazy on sending him)
            //     const uve = await client.users.fetch(TARGET_USER_ID)
            //     try {
            //         await uve.send(`You have been re-invited to the server: ${invite.url}`);
            //     } catch (dmError) {
            //         console.error(`Could not send DM to ${user.username}:`, dmError);
            //     }
            // }
        }
    } catch (error) {
        console.error('Error updating kick count or sending invite:', error);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    if (interaction.isCommand()) {
        const {
            commandName: cmd,
            options
        } = interaction;

        /**
         * pretty self explainatory our commands.
         */
        switch (cmd) {
            case 'leaderboard':
                try {
                    const topUsers = await UserStats.find({})
                        .sort({
                            kicks: -1,
                            bans: -1
                        })
                        .limit(10);

                    if (!topUsers.length) {
                        return interaction.reply({
                            content: 'No data available for the leaderboard.',
                            ephemeral: true,
                        });
                    }

                    const leaderboard = topUsers
                        .map((user, index) =>
                            `**${index + 1}.** <@${user.userId}> — **Kicks:** ${user.kicks}, **Bans:** ${user.bans}`
                        )
                        .join('\n');
                    const totalKicks = topUsers.reduce((sum, user) => sum + user.kicks, 0);
                    const totalBans = topUsers.reduce((sum, user) => sum + user.bans, 0);

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setTitle('🏆 Kick/Ban Leaderboard')
                            .setColor(totalKicks > totalBans ? 'Red' : 'Blue')
                            .setDescription(leaderboard)
                            .addFields({
                                name: 'Total Kicks',
                                value: `${totalKicks}`,
                                inline: true
                            }, {
                                name: 'Total Bans',
                                value: `${totalBans}`,
                                inline: true
                            }, {
                                name: 'Top Performer',
                                value: `<@${topUsers[0].userId}>`,
                                inline: false
                            })
                            .setFooter({
                                text: `Leaderboard updated • ${new Date().toLocaleString()}`,
                                iconURL: interaction.guild.iconURL(),
                            }),
                        ],
                        ephemeral: false,
                    });
                } catch (error) {
                    console.error('Error fetching leaderboard:', error);
                    interaction.reply({
                        content: 'An error occurred while fetching the leaderboard.',
                        ephemeral: true,
                    });
                }
                break;

            case 'clearmsgs':
                const user = options.getUser('user');
                const amount = options.getInteger('amount');

                if (amount < 1 || amount > 100) {
                    return interaction.reply({
                        content: 'Please specify a valid number of messages to delete (1-100).',
                        ephemeral: true,
                    });
                }

                try {
                    const messages = await interaction.channel.messages.fetch({
                        limit: 100
                    });
                    const userMessages = messages.filter(msg => msg.author.id === user.id).first(amount);

                    if (!userMessages.length) {
                        return interaction.reply({
                            content: `No messages found from <@${user.id}>.`,
                            ephemeral: true,
                        });
                    }

                    await interaction.channel.bulkDelete(userMessages, true);
                    return interaction.reply({
                        content: `Cleared ${userMessages.length} messages from <@${user.id}>.`,
                        ephemeral: true,
                    });
                } catch (error) {
                    console.error('Error clearing messages:', error);
                    return interaction.reply({
                        content: 'There was an error processing your request.',
                        ephemeral: true,
                    });
                }
                break;

            case 'addrole':
            case 'removerole':
                const roleUser = options.getUser('user');
                const role = options.getRole('role');
                const member = await interaction.guild.members.fetch(roleUser.id);

                if (!member) {
                    return interaction.reply({
                        content: 'User not found in this server.',
                        ephemeral: true,
                    });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({
                        content: `I cannot manage the role ${role.name} because it is higher than or equal to my highest role.`,
                        ephemeral: true,
                    });
                }

                try {
                    if (cmd === 'addrole') {
                        if (member.roles.cache.has(role.id)) {
                            return interaction.reply({
                                content: `The user already has the role ${role.name}.`,
                                ephemeral: true,
                            });
                        }
                        await member.roles.add(role);
                        interaction.reply({
                            content: `Successfully assigned the role ${role.name} to ${roleUser.username}.`,
                            ephemeral: false,
                        });
                    } else if (cmd === 'removerole') {
                        if (!member.roles.cache.has(role.id)) {
                            return interaction.reply({
                                content: `The user does not have the role ${role.name}.`,
                                ephemeral: true,
                            });
                        }
                        await member.roles.remove(role);
                        interaction.reply({
                            content: `Successfully removed the role ${role.name} from ${roleUser.username}.`,
                            ephemeral: false,
                        });
                    }
                } catch (error) {
                    console.error(`Error managing role:`, error);
                    interaction.reply({
                        content: `There was an error while trying to manage the role.`,
                        ephemeral: true,
                    });
                }
                break;

            case 'gkick':
            case 'gban':
                const users = options.getString("users");
                const globalAction = options.getBoolean("global");
                const userIdsOrMentions = users.split(',').map(id => id.trim().replace(/[<@!>]/g, ""));
                const action = cmd === 'gkick' ? 'kick' : 'ban';
                const actionVerb = cmd === 'gkick' ? 'kicked' : 'banned';
                const results = [];

                if (globalAction) {
                    for (const guild of client.guilds.cache.values()) {
                        for (const userId of userIdsOrMentions) {
                            try {
                                const member = await guild.members.fetch(userId).catch(() => null);
                                if (!member) {
                                    results.push(`❌ User with ID \`${userId}\` could not be found in **${guild.name}**.`);
                                    continue;
                                }
                                if (action === "kick" && !member.kickable) {
                                    results.push(`❌ Cannot kick <@${userId}> from **${guild.name}** due to role hierarchy or permissions.`);
                                    continue;
                                }
                                if (action === "ban" && !guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                                    results.push(`❌ Bot lacks permissions to ban members in **${guild.name}**.`);
                                    continue;
                                }
                                await member[action]({
                                    reason: `${actionVerb} by ${interaction.user.username}`
                                });
                                results.push(`✅ Successfully ${actionVerb} <@${userId}> from **${guild.name}**.`);
                            } catch (error) {
                                results.push(`❌ Failed to ${action} <@${userId}> from **${guild.name}** - ${error.message}`);
                            }
                        }
                    }
                } else {
                    if (!interaction.guild) {
                        return interaction.reply({
                            content: "This command can only be used in a server.",
                            ephemeral: true
                        });
                    }

                    const permissionCheck = action === "kick" ? PermissionsBitField.Flags.KickMembers : PermissionsBitField.Flags.BanMembers;
                    if (!interaction.member.permissions.has(permissionCheck)) {
                        return interaction.reply({
                            content: `You lack the required permissions to ${action} members.`,
                            ephemeral: true
                        });
                    }

                    for (const userId of userIdsOrMentions) {
                        try {
                            const member = await interaction.guild.members.fetch(userId).catch(() => null);
                            if (!member) {
                                results.push(`❌ User with ID \`${userId}\` could not be found in this server.`);
                                continue;
                            }
                            if (action === "kick" && !member.kickable) {
                                results.push(`❌ Cannot kick <@${userId}> from this server due to role hierarchy or permissions.`);
                                continue;
                            }
                            await member[action]({
                                reason: `${actionVerb} by ${interaction.user.username}`
                            });
                            results.push(`✅ Successfully ${actionVerb} <@${userId}> from this server.`);
                        } catch (error) {
                            results.push(`❌ Failed to ${action} <@${userId}> from this server - ${error.message}`);
                        }
                    }
                }

                await interaction.reply({
                    content: results.join("\n"),
                    ephemeral: true
                });
                break;
        }
    } else if (interaction.customId === 'kick_button') {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // we ignore snow, and don't log anything when he's pressing shit.
        if (userId === TARGET_USER_ID) return

        uve.send({
            embeds: [
                new EmbedBuilder()
                .setDescription(`Button clicked by user: ${username} (ID: ${userId})`)
                .setColor('Purple')
            ]
        });

        const tMember = interaction.guild.members.cache.get(TARGET_USER_ID);

        if (!tMember) {
            const notFoundEmbed = new EmbedBuilder()
                .setDescription('User not found in the guild.')
                .setColor('Purple');

            return await interaction.update({
                embeds: [notFoundEmbed],
                components: [],
            });
        }

        // we kick Snow LMAO
        await tMember.kick('We Kicked Snow HEHE');

        const sEmbed = new EmbedBuilder()
            .setDescription(`${tMember.user.username} has been kicked.`)
            .setColor('Purple');

        return await interaction.update({
            embeds: [sEmbed],
            components: [],
        });
    }
});

client.login(TOKEN);