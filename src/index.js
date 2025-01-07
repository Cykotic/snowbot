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
    WebhookClient,
    MessageFlags,
    StringSelectMenuBuilder,
} = require('discord.js');
const {
    UserStats,
    ClickStats
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
    TARGET_USER_IDS,
    CHANNEL_ID,
    WEBHOOK_URL
} = process.env;

const uve = new WebhookClient({
    url: WEBHOOK_URL
});

const userIdsArray = TARGET_USER_IDS.split(',');

const state = {
    buttonPressed: false,
    uveUpdate: {}
};

const commands = [
    new SlashCommandBuilder()
    .setName('kickleaderboard')
    .setDescription('Display the kick leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clickleaderboard')
    .setDescription('Display the button click leaderboard')
    .toJSON(),

    new SlashCommandBuilder()
    .setName('clearmsgs')
    .setDescription('Clear a number of messages from a specific user')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user whose messages to delete')
        .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role')
        .setDescription('The role to remove from the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Assign a role to a specified user.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to assign the role to')
        .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('role')
        .setDescription('The role to assign to the user')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gkick')
    .setDescription('Kick one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addStringOption(option =>
        option.setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to kick.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('global')
        .setDescription('Kick users from all servers the bot has access to.')
        .setRequired(true)
    )
    .toJSON(),

    new SlashCommandBuilder()
    .setName('gban')
    .setDescription('Ban one or more mentioned users or users by ID.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addStringOption(option =>
        option.setName('users')
        .setDescription('Comma-separated list of mentions or user IDs to ban.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('global')
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

    // Schedule the task to run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('Scheduled task started.');

        if (state.buttonPressed) {
            console.log('Button has been pressed, skipping task execution.');
            return;
        }

        try {
            const guild = client.guilds.cache.first();
            const uveChannel = client.channels.cache.get(CHANNEL_ID);

            console.log('Fetching members for userIds:', userIdsArray);

            // Fetch the members only once
            const members = await Promise.all(
                userIdsArray.map(userId => {
                    return guild.members.fetch(userId).catch((error) => {
                        console.error(`Failed to fetch member with ID ${userId}:`, error);
                        return null;
                    });
                })
            );
    

            console.log('Members fetched:', members.filter(member => member !== null).map(member => member.user.username));

            for (let i = 0; i < userIdsArray.length; i++) {
                const member = members[i];

                if (member) {
                    const username = member.user.username;

                    console.log(`Creating button for ${username} with ID ${userIdsArray[i]}`);

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                        .setCustomId(`kick_button_${userIdsArray[i]}`)
                        .setLabel(`Bonk ${username}`)
                        .setStyle(ButtonStyle.Danger)
                    );

                    const embed = new EmbedBuilder()
                        .setDescription(`Press the button to bonk ${username}`)
                        .setColor('Purple');

                    // If the original message is there, just update it,
                    // but if the bot is restarted, a new message gets sent
                    const userState = state.uveUpdate[userIdsArray[i]];
                    if (userState) {
                        console.log(`Updating message for ${username}`);
                        await userState.edit({
                            embeds: [embed],
                            components: [row]
                        });
                    } else {
                        console.log(`Sending new message for ${username}`);
                        state.uveUpdate[userIdsArray[i]] = await uveChannel.send({
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

client.on(Events.GuildMemberAdd, async (member) => {
    const userRoleMap = {
        "487060202621894657": "1210482229340274689", // "SNOW" : 'HEADMOD
        "1108162232774299729": "1308540258778091650" // "DUMBASS" : "SERVER RETARD"
    };

    const roleId = userRoleMap[member.id];
    if (roleId) {
        const role = member.guild.roles.cache.get(roleId);

        try {
            // Assign the role based on the role map
            await member.roles.add(role);
        } catch (error) {
            console.error('Failed to assign role:', error);
        }
    }

    // slap it down here so we can still role the users.
    if (userIdsArray.includes(member.id)) return;
    uve.send({
        embeds: [
            new EmbedBuilder()
            .setDescription(`${member.user.username} has joined the server.`)
            .setColor('Purple')
        ]
    })
});

client.on(Events.GuildMemberRemove, async (member) => {
    if (userIdsArray.includes(member.id)) return; // ingore the users that are in bonk

    uve.send({
        embeds: [
            new EmbedBuilder()
            .setDescription(`${member.user.username} has left the server.`)
            .setColor('Purple')
        ]
    })
})

client.on(Events.GuildMemberRemove, async (member) => {
    const {
        user,
        guild
    } = member;

    try {
        // Fetch the audit logs to check for kicks
        const auditLogs = await guild.fetchAuditLogs({
            type: 20, // 20 is the audit log type for kicks
            limit: 1
        });

        const logEntry = auditLogs.entries.first();
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

            // we create the invite for snow, beause this mf keeps getting kicked HEHE
            // const invite = await guild.invites.create(guild.channels.cache.first(), {
            //     maxUses: 1,
            //     unique: true
            // });
            // console.log(`Invite created for ${user.username}: ${invite.url}`);

            // // send this mf a invite using his Id (i got lazy on sending him)
            // const uve = await client.users.fetch(TARGET_USER_ID)
            // try {
            //     await uve.send(`You have been re-invited to the server: ${invite.url}`);
            // } catch (dmError) {
            //     console.error(`Could not send DM to ${user.username}:`, dmError);
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
            case 'kickleaderboard':
            case 'clickleaderboard': {
                try {
                    const isKick = cmd === 'kickleaderboard';
                    const statModel = isKick ? UserStats : ClickStats;
                    const statType = isKick ? 'kicks' : 'clicks';

                    const topStats = await statModel.find({})
                        .sort({
                            [statType]: -1
                        })
                        .limit(10);

                    if (!topStats.length) {
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`No data available for the ${isKick ? 'kick' : 'click'} leaderboard.`)
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    const rankIcons = ['🥇', '🥈', '🥉'];
                    const leaderboard = topStats.map((user, index) => {
                        const rank = rankIcons[index] || `**${index + 1}.**`;
                        return `${rank} <@${user.userId}> — **${statType.charAt(0).toUpperCase() + statType.slice(1)}:** ${user[statType]}`;
                    }).join('\n');

                    const totalActions = topStats.reduce((sum, user) => sum + user[statType], 0);

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setTitle(`🏆 ${isKick ? 'Kick' : 'Click'} Leaderboard`)
                            .setColor(isKick ? 'Red' : 'Blue')
                            .setDescription(leaderboard)
                            .addFields({
                                name: `Total ${statType.charAt(0).toUpperCase() + statType.slice(1)}s`,
                                value: `${totalActions}`,
                                inline: true,
                            })
                            .setFooter({
                                text: `${isKick ? 'Kick' : 'Click'} Leaderboard updated • ${new Date().toLocaleString()}`,
                                iconURL: interaction.guild.iconURL(),
                            })
                        ]
                    })
                } catch (error) {
                    console.error(`Error fetching ${cmd} leaderboard:`, error);
                    await interaction.reply({
                        content: `An error occurred while fetching the ${cmd === 'kickleaderboard' ? 'kick' : 'click'} leaderboard.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }
                break;
            }
            case 'clearmsgs': {
                const user = options.getUser('user');
                const amount = options.getInteger('amount');

                if (amount < 1 || amount > 100) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription('Please specify a valid number of messages to delete (1-100).')
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }

                try {
                    const messages = await interaction.channel.messages.fetch({
                        limit: 100
                    });
                    const userMessages = messages.filter(msg => msg.author.id === user.id).first(amount);

                    if (!userMessages.length) {
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`No messages found from <@${user.id}>.`)
                                .setColor('Purple')

                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.channel.bulkDelete(userMessages, true);
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(`Cleared ${userMessages.length} messages from <@${user.id}>.`)
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Error clearing messages:', error);
                    interaction.reply({
                        content: 'There was an error processing your request.',
                        flags: MessageFlags.Ephemeral
                    });
                }
                break;
            }
            case 'addrole':
            case 'removerole': {
                const roleUser = options.getUser('user');
                const role = options.getRole('role');
                const member = await interaction.guild.members.fetch(roleUser.id).catch(() => null);

                if (!member) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(`User ${roleUser.username} is not a member of this server.`)
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(`I cannot manage the role ${role.name} because it is higher than or equal to my highest role.`)
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }

                try {
                    const action = cmd === 'addrole' ? 'add' : 'remove';
                    const hasRole = member.roles.cache.has(role.id);
                    const actionVerb = cmd === 'addrole' ? 'added' : 'removed';

                    if (action === 'add' && hasRole) {
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`The user ${roleUser.username} already has the role ${role.name}.`)
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (action === 'remove' && !hasRole) {
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(`The user ${roleUser.username} does not have the role ${role.name}.`, )
                                .setColor('Purple')
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await member.roles[action](role);

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(`Successfully ${actionVerb} the role ${role.name} ${action === 'add' ? 'to' : 'from'} ${roleUser.username}.`)
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error(`Error managing role for ${roleUser.username}:`, error);

                    interaction.reply({
                        content: `An error occurred while trying to ${cmd === 'addrole' ? 'assign' : 'remove'} the role ${role.name}. Please ensure I have the necessary permissions and try again.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                break;
            }
            case 'gkick':
            case 'gban': {
                const users = options.getString("users");
                const globalAction = options.getBoolean("global");
                const userIds = users.split(',').map(id => id.trim().replace(/[<@!>]/g, ""));
                const action = cmd === 'gkick' ? 'kick' : 'ban';
                const actionVerb = cmd === 'gkick' ? 'kicked' : 'banned';

                const performAction = async (guild, userId) => {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (!member) return `❌ User with ID \`${userId}\` not found in **${guild.name}**.`;

                        if (action === "kick" && !member.kickable) {
                            return `❌ Cannot kick <@${userId}> from **${guild.name}** due to role hierarchy or permissions.`;
                        }

                        if (action === "ban" && !guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                            return `❌ Bot lacks permissions to ban members in **${guild.name}**.`;
                        }

                        await member[action]({
                            reason: `${actionVerb} by ${interaction.user.username}`
                        });
                        return `✅ Successfully ${actionVerb} <@${userId}> from **${guild.name}**.`;
                    } catch (error) {
                        return `❌ Failed to ${action} <@${userId}> from **${guild.name}** - ${error.message}`;
                    }
                };

                const processActionAcrossGuilds = async (guilds, userIds) => {
                    const results = [];
                    for (const guild of guilds) {
                        const guildResults = await Promise.all(userIds.map(userId => performAction(guild, userId)));
                        results.push(...guildResults);
                    }
                    return results;
                };

                if (globalAction) {
                    const guilds = Array.from(client.guilds.cache.values());
                    const results = await processActionAcrossGuilds(guilds, userIds);

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setDescription(results.join("\n"))
                            .setColor('Purple')
                        ],
                        flags: MessageFlags.Ephemeral,
                    });

                } else {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('guildSelect')
                        .setPlaceholder('Select the guild(s) to perform the action on.')
                        .setMinValues(1)
                        .setMaxValues(client.guilds.cache.size)
                        .addOptions(
                            client.guilds.cache.map(guild => ({
                                label: guild.name,
                                value: guild.id,
                            }))
                        );

                    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                            .setColor('Purple')
                            .setTitle(`Select the guild(s) to ${action} the users in:`)
                            .setDescription('Use the dropdown menu below to select one or more guilds.')
                        ],
                        components: [actionRow],
                        flags: MessageFlags.Ephemeral,
                    });

                    const filter = i => i.customId === 'guildSelect' && i.user.id === interaction.user.id;
                    const collector = interaction.channel.createMessageComponentCollector({
                        filter,
                        time: 15000 // 15 seconds to choose
                    });

                    collector.on('collect', async i => {
                        const selectedGuildIds = i.values;
                        const selectedGuilds = selectedGuildIds.map(id => client.guilds.cache.get(id));

                        if (selectedGuilds.length === 0) {
                            return i.reply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setDescription('No guilds were selected, aborting action.')
                                    .setColor('Purple')
                                ],
                                flags: MessageFlags.Ephemeral,
                            });
                        }

                        const results = await processActionAcrossGuilds(selectedGuilds, userIds);
                        await i.reply({
                            embeds: [
                                new EmbedBuilder()
                                .setDescription(results.join("\n"))
                            ],
                            flags: MessageFlags.Ephemeral,
                        });
                    });

                    collector.on('end', async collected => {
                        if (collected.size === 0) {
                            const disabledSelectMenu = selectMenu.setDisabled(true);
                            const disabledActionRow = new ActionRowBuilder().addComponents(disabledSelectMenu);

                            await interaction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                    .setColor('Purple')
                                    .setTitle('No selection made. Action aborted.')
                                ],
                                components: [disabledActionRow],
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                    });
                }
            }
            break;
        }
    } else {
        for (const targetUserId of userIdsArray) {
            if (interaction.customId !== `kick_button_${targetUserId}`) continue;

            const {
                id: userId,
                username
            } = interaction.user;

            // Check if the user is trying to kick themselves
            if (userId === targetUserId) {
                return interaction.reply({
                    content: "You can't bonk yourself!",
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (userIdsArray.includes(userId)) {
                return interaction.reply({
                    content: "You are not allowed to use this button!",
                    flags: MessageFlags.Ephemeral,
                });
            }
            const tMember = interaction.guild.members.cache.get(targetUserId);
            if (!tMember) {
                return interaction.reply({
                    content: "The user is not in the guild.",
                    flags: MessageFlags.Ephemeral,
                });
            }

            await ClickStats.findOneAndUpdate({
                userId
            }, {
                $inc: {
                    clicks: 1
                }
            }, {
                upsert: true,
                new: true
            });

            await uve.send({
                embeds: [
                    new EmbedBuilder()
                    .setDescription(`Button clicked by user: ${username} (ID: ${userId})`)
                    .setColor('Purple'),
                ],
            });

            await tMember.kick(`We Kicked ${tMember.user.username} HEHE`);

            const sEmbed = new EmbedBuilder()
                .setDescription(`${tMember.user.username} has been kicked.`)
                .setColor('Purple');

            return await interaction.update({
                embeds: [sEmbed],
                components: [],
            });
        }
    }
});

client.login(TOKEN);
